import aws_cdk as cdk
from aws_cdk import (
    Duration,
    CfnOutput,
    RemovalPolicy,
    aws_s3 as s3,
    aws_s3_deployment as s3deploy,
    aws_s3_notifications as s3n,
    aws_lambda as lambda_,
    aws_cognito as cognito,
    aws_apigateway as apigw,
    aws_iam as iam,
    aws_secretsmanager as secretsmanager,
)
from constructs import Construct


class BackendStack(cdk.Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── Google OAuth secret (resolved at deploy time, never in source) ──
        google_oauth_secret = secretsmanager.Secret.from_secret_name_v2(
            self,
            "GoogleOAuthSecret",
            "prudent/google-oauth",
        )
        google_client_id = google_oauth_secret.secret_value_from_json("client_id").unsafe_unwrap()
        google_client_secret_value = google_oauth_secret.secret_value_from_json("client_secret")

        # ── S3 Data Bucket ────────────────────────────────────────────────
        bucket = s3.Bucket(
            self,
            "PrudentBucket",
            bucket_name=f"prudent-{self.account}-{self.region}",
            removal_policy=RemovalPolicy.RETAIN,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            cors=[
                s3.CorsRule(
                    allowed_methods=[s3.HttpMethods.PUT],
                    allowed_origins=["*"],
                    allowed_headers=["*"],
                    max_age=3000,
                )
            ],
        )

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
            self_sign_up_enabled=False,
            sign_in_aliases=cognito.SignInAliases(email=True),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=True),
                given_name=cognito.StandardAttribute(required=False, mutable=True),
                family_name=cognito.StandardAttribute(required=False, mutable=True),
                fullname=cognito.StandardAttribute(required=False, mutable=True),
            ),
            removal_policy=RemovalPolicy.RETAIN,
        )

        google_provider = cognito.UserPoolIdentityProviderGoogle(
            self,
            "GoogleProvider",
            user_pool=user_pool,
            client_id=google_client_id,
            client_secret_value=google_client_secret_value,
            scopes=["openid", "email", "profile"],
            attribute_mapping=cognito.AttributeMapping(
                email=cognito.ProviderAttribute.GOOGLE_EMAIL,
                given_name=cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
                family_name=cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
                fullname=cognito.ProviderAttribute.GOOGLE_NAME,
            ),
        )
        user_pool.register_identity_provider(google_provider)

        domain_name = "prudigo.com"

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
                callback_urls=["http://localhost:5173", f"https://{domain_name}"],
                logout_urls=["http://localhost:5173", f"https://{domain_name}"],
            ),
            supported_identity_providers=[
                cognito.UserPoolClientIdentityProvider.GOOGLE,
            ],
        )
        user_pool_client.node.add_dependency(google_provider)

        user_pool_domain = user_pool.add_domain(
            "PrudentDomain",
            cognito_domain=cognito.CognitoDomainOptions(
                domain_prefix=f"prudent-{self.account}",
            ),
        )

        # ── Shared Lambda environment ─────────────────────────────────────
        allowed_origins = self.node.try_get_context("allowedOrigins") or "*"
        common_env = {"S3_BUCKET": bucket.bucket_name, "ALLOWED_ORIGINS": allowed_origins}

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
        bucket.grant_read_write(scan_receipt_fn)
        scan_receipt_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=["s3:PutObject"],
                resources=[bucket.arn_for_objects("receipts/raw/*")],
            )
        )

        # S3-triggered Lambda: parse uploaded receipts with Textract
        parse_receipt_fn = lambda_.Function(
            self,
            "ParseReceiptFn",
            function_name="prudent-parse-receipt",
            code=lambda_.Code.from_asset("lambdas/receipts"),
            handler="parse_receipt.handler",
            runtime=lambda_.Runtime.PYTHON_3_12,
            timeout=Duration.seconds(120),  # Textract can be slow for PDFs
            environment=common_env,
        )
        bucket.grant_read_write(parse_receipt_fn)
        parse_receipt_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=["textract:AnalyzeExpense"],
                resources=["*"],
            )
        )
        # Trigger automatically when the client uploads a raw receipt image/PDF
        bucket.add_event_notification(
            s3.EventType.OBJECT_CREATED,
            s3n.LambdaDestination(parse_receipt_fn),
            s3.NotificationKeyFilter(prefix="receipts/raw/"),
        )

        accounts_fn = lambda_.Function(
            self,
            "AccountsFn",
            function_name="prudent-accounts",
            code=lambda_.Code.from_asset("lambdas/accounts"),
            handler="handler.handler",
            **lambda_defaults,
        )
        bucket.grant_read_write(accounts_fn)

        invites_fn = lambda_.Function(
            self,
            "InvitesFn",
            function_name="prudent-invites",
            code=lambda_.Code.from_asset("lambdas/invites"),
            handler="handler.handler",
            environment={
                **common_env,
                "APP_URL": "https://prudigo.com",
            },
            runtime=lambda_.Runtime.PYTHON_3_12,
            timeout=Duration.seconds(29),
        )
        bucket.grant_read_write(invites_fn)

        # ── API Gateway REST API ──────────────────────────────────────────
        api = apigw.RestApi(
            self,
            "PrudentApi",
            rest_api_name="prudent-api",
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=apigw.Cors.ALL_ORIGINS,
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=["Authorization", "Content-Type", "X-Account-Id"],
            ),
        )

        cognito_authorizer = apigw.CognitoUserPoolsAuthorizer(
            self,
            "CognitoAuthorizer",
            cognito_user_pools=[user_pool],
            authorizer_name="prudent-cognito-authorizer",
            identity_source="method.request.header.Authorization",
        )

        auth_kwargs = dict(
            authorization_type=apigw.AuthorizationType.COGNITO,
            authorizer=cognito_authorizer,
        )

        me_resource = api.root.add_resource("me")
        me_resource.add_method("GET", apigw.LambdaIntegration(get_user_fn), **auth_kwargs)

        things_resource = api.root.add_resource("things")
        things_integration = apigw.LambdaIntegration(things_fn)
        things_resource.add_method("GET", things_integration, **auth_kwargs)
        things_resource.add_method("POST", things_integration, **auth_kwargs)
        things_resource.add_resource("{thingId}").add_method("PUT", things_integration, **auth_kwargs)

        categories_resource = api.root.add_resource("categories")
        categories_integration = apigw.LambdaIntegration(categories_fn)
        categories_resource.add_method("GET", categories_integration, **auth_kwargs)
        categories_resource.add_method("POST", categories_integration, **auth_kwargs)
        categories_resource.add_resource("{categoryId}").add_method("PUT", categories_integration, **auth_kwargs)

        tags_resource = api.root.add_resource("tags")
        tags_integration = apigw.LambdaIntegration(tags_fn)
        tags_resource.add_method("GET", tags_integration, **auth_kwargs)
        tags_resource.add_method("POST", tags_integration, **auth_kwargs)
        tags_resource.add_resource("{tagId}").add_method("PUT", tags_integration, **auth_kwargs)

        budgets_resource = api.root.add_resource("budgets")
        budgets_integration = apigw.LambdaIntegration(budgets_fn)
        budgets_resource.add_method("GET", budgets_integration, **auth_kwargs)
        budgets_resource.add_method("POST", budgets_integration, **auth_kwargs)
        budgets_resource.add_resource("{budgetId}").add_method("PUT", budgets_integration, **auth_kwargs)

        transactions_resource = api.root.add_resource("transactions")
        transactions_integration = apigw.LambdaIntegration(transactions_fn)
        transactions_resource.add_method("POST", transactions_integration, **auth_kwargs)
        transactions_resource.add_method("GET", apigw.LambdaIntegration(view_transactions_fn), **auth_kwargs)
        transactions_resource.add_resource("{transactionId}").add_method("PUT", transactions_integration, **auth_kwargs)

        receipts_resource = api.root.add_resource("receipts")
        receipts_resource.add_method("POST", apigw.LambdaIntegration(scan_receipt_fn), **auth_kwargs)

        account_resource = api.root.add_resource("account")
        account_resource.add_method("GET", apigw.LambdaIntegration(accounts_fn), **auth_kwargs)

        accounts_resource = api.root.add_resource("accounts")
        accounts_resource.add_method("POST", apigw.LambdaIntegration(accounts_fn), **auth_kwargs)

        invites_resource = api.root.add_resource("invites")
        invites_integration = apigw.LambdaIntegration(invites_fn)
        invites_resource.add_method("POST", invites_integration, **auth_kwargs)
        invites_resource.add_resource("accept").add_method("POST", invites_integration, **auth_kwargs)
        invites_resource.add_resource("{inviteId}").add_method("DELETE", invites_integration, **auth_kwargs)

        # ── Gateway responses — inject CORS headers into ALL error responses ──
        # Without this, unhandled Lambda errors (502) and auth failures (401/403)
        # return without Access-Control-Allow-Origin, which browsers report as CORS errors.
        cors_headers = {
            "Access-Control-Allow-Origin": "'*'",
            "Access-Control-Allow-Headers": "'Authorization,Content-Type,X-Account-Id'",
        }
        api.add_gateway_response(
            "GwDefault4XX",
            type=apigw.ResponseType.DEFAULT_4_XX,
            response_headers=cors_headers,
        )
        api.add_gateway_response(
            "GwDefault5XX",
            type=apigw.ResponseType.DEFAULT_5_XX,
            response_headers=cors_headers,
        )

        # ── Stack outputs (also consumed by FrontendStack) ────────────────
        CfnOutput(self, "ApiUrl", value=api.url, description="REST API base URL")
        CfnOutput(self, "UserPoolId", value=user_pool.user_pool_id, description="Cognito User Pool ID")
        CfnOutput(self, "UserPoolClientId", value=user_pool_client.user_pool_client_id, description="Cognito App Client ID")
        CfnOutput(
            self,
            "HostedUiUrl",
            value=user_pool_domain.base_url(),
            description="Cognito Hosted UI base URL",
        )

        # Expose as properties so FrontendStack can reference them
        self.api_url = api.url
        self.user_pool_id = user_pool.user_pool_id
        self.user_pool_client_id = user_pool_client.user_pool_client_id
        self.hosted_ui_url = user_pool_domain.base_url()
