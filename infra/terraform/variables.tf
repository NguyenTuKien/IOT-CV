variable "aws_account_id" {
  description = "Expected account; prevents deployment into a different logged-in account."
  type        = string
  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "Supply the expected 12-digit AWS account ID."
  }
}

variable "aws_region" {
  description = "Explicit deployment region."
  type        = string
  default     = "ap-southeast-2"
}

variable "availability_zone" {
  description = "AZ for the instance and its retained data disk."
  type        = string
  default     = "ap-southeast-2a"
}

variable "environment" {
  description = "Deployment environment and resource-name suffix."
  type        = string
  default     = "demo"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{0,19}$", var.environment))
    error_message = "Use a short lowercase environment name."
  }
}

variable "hostname" {
  description = "Public Cloudflare hostname; this does not create DNS or tunnel routes."
  type        = string
  default     = "uav.ngtukien.id.vn"
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]+[a-z0-9]$", var.hostname))
    error_message = "Supply a hostname, without a scheme or path."
  }
}

variable "ami_id" {
  description = "Pinned, reviewed Ubuntu x86-64 AMI in the chosen region."
  type        = string
  validation {
    condition     = can(regex("^ami-[0-9a-f]+$", var.ami_id))
    error_message = "Supply a real AMI ID for this region."
  }
}

variable "instance_type" {
  description = "EC2 size; demo defaults to the verified 2-vCPU, 8-GiB Free Tier type."
  type        = string
  default     = "m7i-flex.large"
  validation {
    condition     = contains(["m7i-flex.large", "c7i-flex.large", "t3.small", "t3.micro"], var.instance_type)
    error_message = "This x86-64 demo configuration allows only the listed Free Tier instance types."
  }
}

variable "key_pair_name" {
  description = "Name of the imported public SSH key. No private key enters Terraform."
  type        = string
  default     = "iotcv-demo"
}

variable "ssh_public_key" {
  description = "Public OpenSSH key generated outside the repository."
  type        = string
  validation {
    condition     = can(regex("^ssh-(ed25519|rsa) ", var.ssh_public_key))
    error_message = "Supply only an OpenSSH PUBLIC key."
  }
}

variable "ssh_allowed_cidr" {
  description = "Explicit IPv4 CIDR permitted to reach SSH. Never world-open."
  type        = string
  validation {
    condition     = can(cidrnetmask(var.ssh_allowed_cidr)) && var.ssh_allowed_cidr != "0.0.0.0/0"
    error_message = "Set an explicit IPv4 SSH allowlist, normally the operator IP/32."
  }
}

variable "root_volume_gib" {
  description = "Encrypted gp3 OS/image-cache disk."
  type        = number
  default     = 30
}

variable "data_volume_gib" {
  description = "Encrypted retained gp3 disk for logs, models and runner workspace."
  type        = number
  default     = 30
}

variable "enable_elastic_ip" {
  description = "Keep the deployment IP stable across instance replacement. IPv4 uses credit."
  type        = bool
  default     = true
}

variable "vpc_cidr" {
  description = "Dedicated IOT-CV VPC, separate from other projects."
  type        = string
  default     = "10.73.0.0/24"
}

variable "subnet_cidr" {
  description = "Public subnet for SSH and outbound tunnel traffic."
  type        = string
  default     = "10.73.0.0/26"
}

variable "ssh_user" {
  description = "AMI's initial SSH user."
  type        = string
  default     = "ubuntu"
}

variable "deployment_role_arn" {
  description = "Optional approved GitHub OIDC role, created by the separate oidc stack."
  type        = string
  default     = null
}
