
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
    exit 1
fi

apt-get update
apt-get install -y git curl ca-certificates

git clone "$REPO" "$APP_DIR"
cd "$APP_DIR"

bash "$SETUP"

if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is missing."
    exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")

if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "Node.js 20+ required. Detected: $(node --version)"
    exit 1
fi

npm install --omit=dev

echo ""
echo "================================"
echo "      KM DEV CONFIGURATION"
echo "================================"

bash configure.sh

echo ""
echo "Creating dedicated service user..."

if ! id kmdev >/dev/null 2>&1; then
    useradd --system --create-home --shell /usr/sbin/nologin kmdev
fi

chown -R kmdev:kmdev "$APP_DIR"
chmod 600 "$APP_DIR/.env"

if [ ! -f "$APP_DIR/km-dev.service" ]; then
    echo "km-dev.service not found."
    exit 1
fi

install -m 644 "$APP_DIR/km-dev.service" \
    /etc/systemd/system/km-dev.service

systemctl daemon-reload
systemctl enable km-dev

echo ""
echo "================================"
echo "       KM DEV INSTALLED"
echo "================================"
echo "Dedicated user: kmdev"
echo "Service enabled."
echo "Service is not started yet."
