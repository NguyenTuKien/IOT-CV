mock_provider "aws" {
  mock_data "aws_ami" {
    defaults = { id = "ami-00000000000000001" }
  }
}

variables {
  aws_account_id   = "123456789012"
  ami_id           = "ami-00000000000000001"
  ssh_public_key   = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEEkgPxyYQHAc9X30pw5LOdw7yiDvVqtOuht31XoAFcX"
  ssh_allowed_cidr = "203.0.113.10/32"
}

run "safe_demo_plan" {
  command = plan
  assert {
    condition     = aws_vpc_security_group_ingress_rule.ssh.from_port == 22 && aws_vpc_security_group_ingress_rule.ssh.to_port == 22
    error_message = "Only SSH should have a public ingress rule."
  }
  assert {
    condition     = aws_ebs_volume.data.encrypted && aws_instance.application.root_block_device[0].encrypted
    error_message = "All persistent disks must be encrypted."
  }
  assert {
    condition     = aws_instance.application.metadata_options[0].http_tokens == "required"
    error_message = "IMDSv2 is required."
  }
}

run "reject_world_open_ssh" {
  command = plan
  variables {
    ssh_allowed_cidr = "0.0.0.0/0"
  }
  expect_failures = [var.ssh_allowed_cidr]
}
