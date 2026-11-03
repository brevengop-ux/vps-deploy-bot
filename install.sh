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
    echo "Please run installer as root."
    exit 1
fi

if [ ! -f /etc/os-release ]; then
    echo "Cannot detect operating system."
    exit 1
fi

. /etc/os-release

case "$choice" in
    1)
        if [ "$ID" != "ubuntu" ]; then
            echo "This VPS is not running Ubuntu."
            exit 1
        fi
        SETUP="setup-ubuntu.sh"
        ;;
    2)
        if [ "$ID" != "debian" ]; then
            echo "This VPS is not running Debian."
            exit 1
        fi
        SETUP="setup-debian.sh"
        ;;
    *)
        echo "Invalid selection."
        exit 1
        ;;
esac

apt-get update
apt-get install -y git ca-certificates

APP_DIR="/opt/km-dev-vps-bot"

if [ -e "$APP_DIR" ]; then
    echo "Installation directory already exists: $APP_DIR"
    exit 1
fi

git clone https://github.com/brevengop-ux/vps-deploy-bot.git "$APP_DIR"

cd "$APP_DIR"

bash "$SETUP"

echo ""
echo "KM DEV OS setup completed."
