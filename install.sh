
#!/bin/bash
set -e

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

if [ -e "$APP_DIR" ]; then
    echo "Installation directory already exists."
    exit 1
fi

apt-get update
apt-get install -y git curl ca-certificates nodejs npm

git clone https://github.com/brevengop-ux/vps-deploy-bot.git "$APP_DIR"

cd "$APP_DIR"

bash "$SETUP"

echo ""
echo "Installing bot dependencies..."
npm install --omit=dev

echo ""
echo "================================"
echo "      KM DEV CONFIGURATION"
echo "================================"

bash configure.sh

echo ""
echo "Installation files and configuration ready."
echo "Bot service setup is the next step."
