locals {
  name = "iotcv-${var.environment}"
}

data "aws_ami" "application" {
  owners = ["099720109477"]
  filter {
    name   = "image-id"
    values = [var.ami_id]
  }
  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
  filter {
    name   = "free-tier-eligible"
    values = ["true"]
  }
}

resource "aws_vpc" "application" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = local.name }
}

resource "aws_internet_gateway" "application" {
  vpc_id = aws_vpc.application.id
  tags   = { Name = local.name }
}

resource "aws_subnet" "application" {
  vpc_id                  = aws_vpc.application.id
  cidr_block              = var.subnet_cidr
  availability_zone       = var.availability_zone
  map_public_ip_on_launch = true
  tags                    = { Name = local.name }
}

resource "aws_route_table" "application" {
  vpc_id = aws_vpc.application.id
  tags   = { Name = local.name }
}

resource "aws_route" "internet" {
  route_table_id         = aws_route_table.application.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.application.id
}

resource "aws_route_table_association" "application" {
  subnet_id      = aws_subnet.application.id
  route_table_id = aws_route_table.application.id
}

resource "aws_security_group" "application" {
  name        = local.name
  description = "IOT-CV: allowlisted SSH; application reachable only through Cloudflare Tunnel"
  vpc_id      = aws_vpc.application.id
  tags        = { Name = local.name }
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  security_group_id = aws_security_group.application.id
  description       = "Explicit SSH operator allowlist"
  cidr_ipv4         = var.ssh_allowed_cidr
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
}

# Packages, GitHub, DNS and cloudflared require outbound traffic. No HTTP,
# HTTPS, MQTT or MAVLink ingress rule is created.
resource "aws_vpc_security_group_egress_rule" "outbound" {
  security_group_id = aws_security_group.application.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_key_pair" "deployment" {
  key_name   = var.key_pair_name
  public_key = var.ssh_public_key
}

resource "aws_iam_role" "instance" {
  name = "${local.name}-ec2"
  path = "/iotcv/"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "application" {
  name = "${local.name}-ec2"
  path = "/iotcv/"
  role = aws_iam_role.instance.name
}

resource "aws_instance" "application" {
  ami                    = data.aws_ami.application.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.application.id
  vpc_security_group_ids = [aws_security_group.application.id]
  key_name               = aws_key_pair.deployment.key_name
  iam_instance_profile   = aws_iam_instance_profile.application.name
  # Không có NAT gateway nên máy cần IP công khai để ra internet; SG chỉ mở SSH cho
  # var.ssh_allowed_cidr, web đi qua Cloudflare Tunnel (không mở HTTP/HTTPS vào).
  associate_public_ip_address = true # NOSONAR
  user_data                   = file("${path.module}/user-data.sh")
  user_data_replace_on_change = true

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "disabled"
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_gib
    encrypted             = true
    delete_on_termination = true
  }

  tags       = { Name = local.name, PublicHostname = var.hostname }
  depends_on = [aws_route.internet, aws_route_table_association.application]
}

resource "aws_ebs_volume" "data" {
  availability_zone = var.availability_zone
  size              = var.data_volume_gib
  type              = "gp3"
  encrypted         = true
  tags              = { Name = "${local.name}-data" }
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_volume_attachment" "data" {
  device_name                    = "/dev/sdf"
  volume_id                      = aws_ebs_volume.data.id
  instance_id                    = aws_instance.application.id
  stop_instance_before_detaching = true
}

resource "aws_eip" "application" {
  count  = var.enable_elastic_ip ? 1 : 0
  domain = "vpc"
  tags   = { Name = local.name }
}

resource "aws_eip_association" "application" {
  count         = var.enable_elastic_ip ? 1 : 0
  instance_id   = aws_instance.application.id
  allocation_id = aws_eip.application[0].id
}
