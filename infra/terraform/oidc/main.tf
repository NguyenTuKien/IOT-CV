# Separate opt-in stack: the current Free Plan identity cannot query OIDC
# providers due to SCP. Never change the managed AccountFullAccessRole.
terraform {
  required_version = ">= 1.10, < 2.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  backend "s3" {}
}
variable "aws_region" {
  description = "Region for deployment."
  type        = string
  default     = "ap-southeast-2"
}
variable "aws_account_id" {
  description = "Expected target account."
  type        = string
}
variable "github_repository" {
  description = "Exact owner/repository allowed to federate."
  type        = string
  default     = "ngtukien/IOT-CV"
}
variable "environment" {
  description = "Protected GitHub environment."
  type        = string
  default     = "demo"
}
variable "deployment_policy_arn" {
  description = "Approved least-privilege policy generated/reviewed for the Terraform plan."
  type        = string
}
provider "aws" {
  region              = var.aws_region
  allowed_account_ids = [var.aws_account_id]
}
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}
resource "aws_iam_role" "github" {
  name = "iotcv-${var.environment}-github"
  path = "/iotcv/"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = { StringEquals = {
        "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:${var.environment}"
        "token.actions.githubusercontent.com:ref" = "refs/heads/main"
      } }
    }]
  })
}
resource "aws_iam_role_policy_attachment" "deployment" {
  role       = aws_iam_role.github.name
  policy_arn = var.deployment_policy_arn
}
output "deployment_role_arn" {
  description = "Set GitHub secret AWS_ROLE_ARN only after successful approved bootstrap."
  value       = aws_iam_role.github.arn
}
