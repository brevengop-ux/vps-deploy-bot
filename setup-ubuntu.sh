#!/bin/bash
set -e

echo "================================"
echo "          KM DEV"
echo "       UBUNTU INSTALLER"
echo "================================"

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root."
    exit 1
fi

if ! grep -qi ubuntu /etc/os-release; then
    echo "This installer supports Ubuntu only."
    exit 1
fi

apt-get update
apt-get install -y curl git ca-certificates \
    build-essential python3

echo ""
echo "Ubuntu dependencies installed successfully."
echo "Next: KM DEV bot setup."
