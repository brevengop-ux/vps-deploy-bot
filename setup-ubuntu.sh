
#!/bin/bash
set -euo pipefail

echo "================================"
echo "          KM DEV"
echo "       UBUNTU INSTALLER"
echo "================================"

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root."
    exit 1
fi

. /etc/os-release

if [ "$ID" != "ubuntu" ]; then
    echo "This installer supports Ubuntu only."
    exit 1
fi

echo ""
echo "Updating Ubuntu packages..."

apt-get update

apt-get install -y \
    curl \
    git \
    ca-certificates \
    build-essential \
    python3

echo ""
echo "Installing Node.js 22 LTS..."

curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
bash /tmp/nodesource_setup.sh
rm -f /tmp/nodesource_setup.sh

apt-get install -y nodejs

echo ""
echo "Checking installations..."

node --version
npm --version
git --version
python3 --version

echo ""
echo "================================"
echo " UBUNTU DEPENDENCIES INSTALLED"
echo "================================"
echo "Node.js 22 LTS ready."
echo "Next: KM DEV bot configuration."
