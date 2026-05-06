# Copyright (C) 2026 V.P.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.

import aws_cdk as cdk
from aws_cdk import (
    CfnOutput,
    RemovalPolicy,
    aws_s3 as s3,
    aws_s3_deployment as s3deploy,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_certificatemanager as acm,
)
from constructs import Construct


class FrontendStack(cdk.Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        domain_name = "prudigo.com"

        frontend_bucket = s3.Bucket(
            self,
            "FrontendBucket",
            bucket_name=f"prudent-frontend-{self.account}-{self.region}",
            removal_policy=RemovalPolicy.RETAIN,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
        )

        cert_arn = self.node.try_get_context("frontendCertArn")
        certificate = (
            acm.Certificate.from_certificate_arn(self, "FrontendCert", cert_arn)
            if cert_arn
            else None
        )

        distribution = cloudfront.Distribution(
            self,
            "FrontendDistribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(
                    frontend_bucket,
                    origin_access_levels=[cloudfront.AccessLevel.READ],
                ),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
            ),
            default_root_object="index.html",
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html",
                ),
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",
                ),
            ],
            domain_names=[domain_name, f"www.{domain_name}"] if cert_arn else None,
            certificate=certificate,
        )

        s3deploy.BucketDeployment(
            self,
            "FrontendDeployment",
            sources=[s3deploy.Source.asset("../app/dist")],
            destination_bucket=frontend_bucket,
            distribution=distribution,
            distribution_paths=["/*"],
        )

        CfnOutput(
            self,
            "FrontendBucketName",
            value=frontend_bucket.bucket_name,
            description="S3 bucket for frontend assets",
        )
        CfnOutput(
            self,
            "CloudFrontDomain",
            value=distribution.distribution_domain_name,
            description="CloudFront distribution domain (use as CNAME target for prudigo.com)",
        )
