#!/bin/bash
# Script to auto-install puppeteer dependencies for PDF generation
# This script is designed to run during deployment

echo "Installing puppeteer dependencies..."

# Install dependencies needed for puppeteer to run properly in headless mode
apt-get update

# Install dependencies for puppeteer
apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    xvfb

echo "Puppeteer dependencies installed successfully"

# Setup a virtual display for puppeteer
export DISPLAY=:99
mkdir -p /tmp/.X11-unix
Xvfb -ac :99 -screen 0 1280x1024x16 > /dev/null 2>&1 &

echo "Xvfb started on display :99"

# Add fonts for PDF generation
echo "Installing additional fonts for better PDF rendering..."
apt-get install -y fonts-noto fonts-noto-cjk fonts-noto-color-emoji

echo "Installation complete"