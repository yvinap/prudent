import aws_cdk as cdk
from backend_stack import BackendStack
from frontend_stack import FrontendStack

app = cdk.App()
BackendStack(app, "PrudentBackendStack")
FrontendStack(app, "PrudentFrontendStack")

app.synth()
