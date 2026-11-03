
#!/bin/bash
set -euo pipefail

clear

echo "================================"
echo "           KM DEV"
echo "       VPS DEPLOY INSTALLER"
echo "================================"
echo ""
echo "1. Ubuntu"
echo "2. Debian"
echo ""

read -rp "Select OS (1/2): " choice

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root."
    exit 1
fi

. /etc/os-release

case "$choice" in
    1)
        [ "$ID" = "ubuntu" ] || {
            echo "Ubuntu VPS required."
            exit 1
        }
        SETUP="setup-ubuntu.sh"
        ;;
    2)
        [ "$ID" = "debian" ] || {
            echo "Debian VPS required."
            exit 1
        }
        SETUP="setup-debian.sh"
        ;;
    *)
        echo "Invalid selection."
        exit 1
        ;;
esac

APP_DIR="/opt/km-dev-vps-bot"
REPO="https://github.com/brevengop-ux/vps-deploy-bot.git"

if [ -e "$APP_DIR" ]; then
    echo "Installation directory already exists."
    echo "Please check $APP_DIR before continuing."
    exit 1
fi

echo ""
echo "Installing system dependencies..."

apt-get update
apt-get install -y git curl ca-certificates

echo ""
echo "Downloading KM DEV..."

git clone "$REPO" "$APP_DIR"
cd "$APP_DIR"

echo ""
echo "Running OS setup..."
bash "$SETUP"

echo ""
echo "Checking Node.js..."

if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is not installed."
    exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")

if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "Node.js 20 or newer is required."
    echo "Detected version: $(node --version)"
    exit 1
fi

echo "Node.js version: $(node --version)"

echo ""
echo "Installing bot dependencies..."
npm install --omit=dev

echo ""
echo "================================"
echo "      KM DEV CONFIGURATION"
echo "================================"

bash configure.sh

echo ""
echo "Checking service file..."

if [ ! -f km-dev.service ]; then
    echo "Error: km-dev.service not found."
    exit 1
fi

echo ""
echo "Installing KM DEV service..."

cp km-dev.service /etc/systemd/system/km-dev.service

systemctl daemon-reload
systemctl enable km-dev

echo ""
echo "================================"
echo "       KM DEV INSTALLED"
echo "================================"

echo "Project directory: $APP_DIR"
echo "Configuration saved in .env"
echo "Service enabled for system startup."
echo ""
echo "IMPORTANT: Service has not been started yet."
echo "The service permissions must be configured first."
