output "instance_id" {
  description = "Application EC2 instance."
  value       = aws_instance.application.id
}
output "public_ip" {
  description = "Deployment address; stable when Elastic IP is enabled."
  value       = var.enable_elastic_ip ? aws_eip.application[0].public_ip : aws_instance.application.public_ip
}
output "ssh_command" {
  description = "Use a private key stored outside the repository and verified known_hosts."
  value       = "ssh ${var.ssh_user}@${var.enable_elastic_ip ? aws_eip.application[0].public_ip : aws_instance.application.public_ip}"
}
output "data_volume_id" {
  description = "Retained encrypted application data disk."
  value       = aws_ebs_volume.data.id
}
output "security_group_id" {
  description = "Only the configured SSH CIDR has inbound access."
  value       = aws_security_group.application.id
}
output "instance_profile_arn" {
  description = "SSM-only EC2 instance profile."
  value       = aws_iam_instance_profile.application.arn
}
output "deployment_role_arn" {
  description = "Approved GitHub OIDC role, or null when SCP prevents OIDC bootstrap."
  value       = var.deployment_role_arn
}
output "environment" {
  description = "Deployment environment."
  value       = var.environment
}
output "hostname" {
  description = "Public hostname requiring an independently verified Cloudflare route."
  value       = var.hostname
}
