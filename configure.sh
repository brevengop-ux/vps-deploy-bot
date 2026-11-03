#!/bin/bash
set -e

cd "$(dirname "$0")"
umask 077

echo "================================"
echo "           KM DEV"
echo "       BOT CONFIGURATION"
echo "================================"
echo ""

read -rsp "Paste your bot token: " BOT_TOKEN
echo ""

if [ -z "$BOT_TOKEN" ]; then
    echo "Error: Bot token cannot be empty."
    exit 1
fi

read -rp "Admin ID: " ADMIN_ID

if [[ ! "$ADMIN_ID" =~ ^[0-9]{17,20}$ ]]; then
    echo "Error: Invalid Discord Admin ID."
    exit 1
fi

cat > .env <<EOF
DISCORD_TOKEN=$BOT_TOKEN
ADMIN_ID=$ADMIN_ID
EOF

chmod 600 .env

unset BOT_TOKEN

echo ""
echo "Configuration saved securely!"
echo "KM DEV setup configuration completed."
