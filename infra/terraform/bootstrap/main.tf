variable "aws_account_id" {
  description = "Expected bootstrap account."
  type        = string
}
variable "aws_region" {
  description = "State bucket region."
  type        = string
  default     = "ap-southeast-2"
}
variable "state_bucket_name" {
  description = "Globally unique private Terraform state bucket."
  type        = string
}

# Bucket state riêng tư (chặn public, versioning, S3 tự mã hoá SSE-S3); không bật access log vì cần
# thêm một bucket log chỉ cho một người triển khai. Lịch sử thay đổi state nằm ở versioning.
resource "aws_s3_bucket" "state" { # NOSONAR
  bucket        = var.state_bucket_name
  force_destroy = false
  lifecycle {
    prevent_destroy = true
  }
}
resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}
resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "RequireTLS"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}
output "state_bucket_name" {
  description = "Use this in the partial S3 backend configuration."
  value       = aws_s3_bucket.state.id
}
output "aws_region" {
  description = "Bucket region."
  value       = var.aws_region
}
