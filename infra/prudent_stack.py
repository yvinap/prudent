import aws_cdk as cdk
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_s3_deployment as s3deploy
from constructs import Construct


class PrudentStack(cdk.Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        bucket = s3.Bucket(
            self,
            "PrudentBucket",
            bucket_name=f"prudent-{self.account}-{self.region}",
            removal_policy=cdk.RemovalPolicy.RETAIN,
        )

        # Create folder placeholders (S3 folders are simulated via key prefixes)
        s3deploy.BucketDeployment(
            self,
            "FolderPlaceholders",
            sources=[
                s3deploy.Source.data("Transactions/.keep", ""),
                s3deploy.Source.data("Metadata/.keep", ""),
                s3deploy.Source.data("AuditLogs/.keep", ""),
            ],
            destination_bucket=bucket,
            destination_key_prefix="",
        )
