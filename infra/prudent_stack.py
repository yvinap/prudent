import aws_cdk as cdk
from aws_cdk import (
    Duration,
    CfnOutput,
    RemovalPolicy,
    aws_s3 as s3,
    aws_s3_deployment as s3deploy,
    aws_lambda as lambda_,
    aws_cognito as cognito,
    aws_apigateway as apigw,
    aws_iam as iam,
    aws_secretsmanager as secretsmanager,
)
from constructs import Construct

# ---------------------------------------------------------------------------
# Google OAuth credentials
# ---------------------------------------------------------------------------
# Store your credentials in AWS Secrets Manager BEFORE deploying:
#
#   aws secretsmanager create-secret \
#     --name prudent/google-oauth \
#     --secret-string '{"client_id":"YOUR_CLIENT_ID.apps.googleusercontent.com","client_secret":"YOUR_CLIENT_SECRET"}'
#
# The secret name is fixed at "prudent/google-oauth".
# Add the following Authorised redirect URI in your Google Cloud Console:
#   https://<cognito-domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse
# ---------------------------------------------------------------------------


class PrudentStack(cdk.Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── Google OAuth secret (resolved at deploy time, never in source) ──
        google_oauth_secret = secretsmanager.Secret.from_secret_name_v2(
            self,
            "GoogleOAuthSecret",
            "prudent/google-oauth",
        )
        # client_id is a public identifier; unsafe_unwrap() embeds it in the
        # CloudFormation template as a dynamic reference that resolves on deploy.
        google_client_id = google_oauth_secret.secret_value_from_json("client_id").unsafe_unwrap()
        # client_secret stays as a SecretValue — CDK passes it as a CFN
        # dynamic reference and it is never written to the template in plaintext.
        google_client_secret_value = google_oauth_secret.secret_value_from_json("client_secret")

        # ── S3 Data Bucket ────────────────────────────────────────────────
        bucket = s3.Bucket(
            self,
            "PrudentBucket",
            bucket_name=f"prudent-{self.account}-{self.region}",
            removal_policy=RemovalPolicy.RETAIN,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            # CORS is required so the browser can PUT receipt images via
            # the presigned URL returned by the scan_receipt Lambda.
            cors=[
                s3.CorsRule(
                    allowed_methods=[s3.HttpMethods.PUT],
                    allowed_origins=["*"],
                    allowed_headers=["*"],
                    max_age=3000,
                )
            ],
        )

        # Folder placeholders (S3 uses key prefixes, not real directories)
        s3deploy.BucketDeployment(
            self,
            "FolderPlaceholders",
            sources=[
                s3deploy.Source.data("Transactions/.keep", ""),
                s3deploy.Source.data("Metadata/.keep", ""),
                s3deploy.Source.data("Receipts/.keep", ""),
                s3deploy.Source.data("AuditLogs/.keep", ""),
            ],
            destination_bucket=bucket,
            destination_key_prefix="",
        )

        # ── Cognito User Pool (Google-only sign-in) ───────────────────────
        user_pool = cognito.UserPool(
            self,
            "PrudentUserPool",
            user_pool_name="prudent-user-pool",
            self_sign_up_enabled=False,  # only Google OAuth
            sign_in_aliases=cognito.SignInAliases(email=True),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=True),
                given_name=cognito.StandardAttribute(required=False, mutable=True),
                family_name=cognito.StandardAttribute(required=False, mutable=True),
                fullname=cognito.StandardAttribute(required=False, mutable=True),
            ),
            removal_policy=RemovalPolicy.RETAIN,
        )

        # Google identity provider
        google_provider = cognito.UserPoolIdentityProviderGoogle(
            self,
            "GoogleProvider",
            user_pool=user_pool,
            client_id=google_client_id,
            client_secret_value=google_client_secret_value,
            # Request the profile scopes so given_name / family_name are returned
            scopes=["openid", "email", "profile"],
            attribute_mapping=cognito.AttributeMapping(
                email=cognito.ProviderAttribute.GOOGLE_EMAIL,
                given_name=cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
                family_name=cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
                fullname=cognito.ProviderAttribute.GOOGLE_NAME,
            ),
        )
        user_pool.register_identity_provider(google_provider)

        # App client (SPA / mobile – no client secret)
        user_pool_client = user_pool.add_client(
            "PrudentAppClient",
            user_pool_client_name="prudent-app",
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(authorization_code_grant=True),
                scopes=[
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.PROFILE,
                ],
                callback_urls=["http://localhost:5173"],   # add prod URL here
                logout_urls=["http://localhost:5173"],
            ),
            supported_identity_providers=[
                cognito.UserPoolClientIdentityProvider.GOOGLE,
            ],
        )
        # CDK does not automatically order the app client after the IdP.
        # Without this, CloudFormation deploys them in parallel and Cognito
        # raises "The provider Google does not exist" when creating the client.
        user_pool_client.node.add_dependency(google_provider)

        # Hosted UI domain (prefix must be globally unique)
        user_pool_domain = user_pool.add_domain(
            "PrudentDomain",
            cognito_domain=cognito.CognitoDomainOptions(
                domain_prefix=f"prudent-{self.account}",
            ),
        )

        # ── Shared Lambda environment & layer ────────────────────────────
        common_env = {"S3_BUCKET": bucket.bucket_name}

        lambda_defaults = {
            "runtime": lambda_.Runtime.PYTHON_3_12,
            "timeout": Duration.seconds(29),
            "environment": common_env,
        }

        # ── register_user – Cognito PostAuthentication trigger ────────────
        register_user_fn = lambda_.Function(
            self,
            "RegisterUserFn",
            function_name="prudent-register-user",
            code=lambda_.Code.from_asset("lambdas/auth"),
            handler="register_user.handler",
            **lambda_defaults,
        )
        bucket.grant_read_write(register_user_fn)
        user_pool.add_trigger(
            cognito.UserPoolOperation.POST_AUTHENTICATION,
            register_user_fn,
        )

        # ── API Lambda functions ──────────────────────────────────────────
        get_user_fn = lambda_.Function(
            self,
            "GetUserFn",
            function_name="prudent-get-user",
            code=lambda_.Code.from_asset("lambdas/auth"),
            handler="get_user.handler",
            **lambda_defaults,
        )
        bucket.grant_read(get_user_fn)

        things_fn = lambda_.Function(
            self,
            "ThingsFn",
            function_name="prudent-things",
            code=lambda_.Code.from_asset("lambdas/things"),
            handler="handler.handler",
            **lambda_defaults,
        )
        bucket.grant_read_write(things_fn)

        categories_fn = lambda_.Function(
            self,
            "CategoriesFn",
            function_name="prudent-categories",
            code=lambda_.Code.from_asset("lambdas/categories"),
            handler="handler.handler",
            **lambda_defaults,
        )
        bucket.grant_read_write(categories_fn)

        tags_fn = lambda_.Function(
            self,
            "TagsFn",
            function_name="prudent-tags",
            code=lambda_.Code.from_asset("lambdas/tags"),
            handler="handler.handler",
            **lambda_defaults,
        )
        bucket.grant_read_write(tags_fn)

        budgets_fn = lambda_.Function(
            self,
            "BudgetsFn",
            function_name="prudent-budgets",
            code=lambda_.Code.from_asset("lambdas/budgets"),
            handler="handler.handler",
            **lambda_defaults,
        )
        bucket.grant_read_write(budgets_fn)

        transactions_fn = lambda_.Function(
            self,
            "TransactionsFn",
            function_name="prudent-transactions",
            code=lambda_.Code.from_asset("lambdas/transactions"),
            handler="handler.handler",
            **lambda_defaults,
        )
        bucket.grant_read_write(transactions_fn)

        view_transactions_fn = lambda_.Function(
            self,
            "ViewTransactionsFn",
            function_name="prudent-view-transactions",
            code=lambda_.Code.from_asset("lambdas/transactions"),
            handler="view_transactions.handler",
            **lambda_defaults,
        )
        bucket.grant_read(view_transactions_fn)

        scan_receipt_fn = lambda_.Function(
            self,
            "ScanReceiptFn",
            function_name="prudent-scan-receipt",
            code=lambda_.Code.from_asset("lambdas/receipts"),
            handler="scan_receipt.handler",
            **lambda_defaults,
        )
        # Needs read (user lookup) + write (receipt metadata + presigned PUTs)
        bucket.grant_read_write(scan_receipt_fn)
        # Allow the function to generate presigned PUT URLs for the raw prefix
        scan_receipt_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=["s3:PutObject"],
                resources=[bucket.arn_for_objects("receipts/raw/*")],
            )
        )

        # ── API Gateway REST API ──────────────────────────────────────────
        api = apigw.RestApi(
            self,
            "PrudentApi",
            rest_api_name="prudent-api",
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=apigw.Cors.ALL_ORIGINS,
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=["Authorization", "Content-Type"],
            ),
        )

        # Cognito JWT authorizer (validates tokens issued for this user pool)
        cognito_authorizer = apigw.CognitoUserPoolsAuthorizer(
            self,
            "CognitoAuthorizer",
            cognito_user_pools=[user_pool],
            authorizer_name="prudent-cognito-authorizer",
            identity_source="method.request.header.Authorization",
        )

        # Shared keyword args applied to every protected method
        auth_kwargs = dict(
            authorization_type=apigw.AuthorizationType.COGNITO,
            authorizer=cognito_authorizer,
        )

        # GET /me
        me_resource = api.root.add_resource("me")
        me_resource.add_method(
            "GET", apigw.LambdaIntegration(get_user_fn), **auth_kwargs
        )

        # POST /things  |  PUT /things/{thingId}
        things_resource = api.root.add_resource("things")
        things_integration = apigw.LambdaIntegration(things_fn)
        things_resource.add_method("POST", things_integration, **auth_kwargs)
        things_resource.add_resource("{thingId}").add_method("PUT", things_integration, **auth_kwargs)

        # POST /categories  |  PUT /categories/{categoryId}
        categories_resource = api.root.add_resource("categories")
        categories_integration = apigw.LambdaIntegration(categories_fn)
        categories_resource.add_method("POST", categories_integration, **auth_kwargs)
        categories_resource.add_resource("{categoryId}").add_method("PUT", categories_integration, **auth_kwargs)

        # POST /tags  |  PUT /tags/{tagId}
        tags_resource = api.root.add_resource("tags")
        tags_integration = apigw.LambdaIntegration(tags_fn)
        tags_resource.add_method("POST", tags_integration, **auth_kwargs)
        tags_resource.add_resource("{tagId}").add_method("PUT", tags_integration, **auth_kwargs)

        # POST /budgets  |  PUT /budgets/{budgetId}
        budgets_resource = api.root.add_resource("budgets")
        budgets_integration = apigw.LambdaIntegration(budgets_fn)
        budgets_resource.add_method("POST", budgets_integration, **auth_kwargs)
        budgets_resource.add_resource("{budgetId}").add_method("PUT", budgets_integration, **auth_kwargs)

        # POST /transactions  |  GET /transactions  |  PUT /transactions/{transactionId}
        transactions_resource = api.root.add_resource("transactions")
        transactions_integration = apigw.LambdaIntegration(transactions_fn)
        transactions_resource.add_method("POST", transactions_integration, **auth_kwargs)
        transactions_resource.add_method("GET", apigw.LambdaIntegration(view_transactions_fn), **auth_kwargs)
        transactions_resource.add_resource("{transactionId}").add_method("PUT", transactions_integration, **auth_kwargs)

        # POST /receipts
        receipts_resource = api.root.add_resource("receipts")
        receipts_resource.add_method(
            "POST", apigw.LambdaIntegration(scan_receipt_fn), **auth_kwargs
        )

        # ── Stack outputs ─────────────────────────────────────────────────
        CfnOutput(self, "ApiUrl", value=api.url, description="REST API base URL")
        CfnOutput(self, "UserPoolId", value=user_pool.user_pool_id, description="Cognito User Pool ID")
        CfnOutput(self, "UserPoolClientId", value=user_pool_client.user_pool_client_id, description="Cognito App Client ID")
        CfnOutput(
            self,
            "HostedUiUrl",
            value=user_pool_domain.base_url(),
            description="Cognito Hosted UI base URL",
        )
