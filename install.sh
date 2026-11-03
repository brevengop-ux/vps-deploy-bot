#!/bin/bash

clear

echo "================================"
echo "           KM DEV"
echo "       VPS DEPLOY INSTALLER"
echo "================================"
echo ""
echo "Select your Operating System:"
echo ""
echo "1. Ubuntu"
echo "2. Debian"
echo ""

read -rp "Enter your choice (1/2): " choice

case "$choice" in
  1)
    OS="Ubuntu"
    ;;
  2)
    OS="Debian"
    ;;
  *)
    echo "Invalid choice!"
    exit 1
    ;;
esac

echo ""
echo "Selected OS: $OS"
echo "KM DEV installer started."
echo ""
