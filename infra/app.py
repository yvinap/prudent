import aws_cdk as cdk
from prudent_stack import PrudentStack

app = cdk.App()
PrudentStack(app, "PrudentStack")

app.synth()
