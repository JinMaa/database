#!/bin/bash

# start-dashboard.sh
# Script to start the Debshrew dashboard for monitoring CDC processing

# Change to project root directory
cd "$(dirname "$0")/.."

# Set environment variables for local Metashrew instance if not already set
if [ -z "$METASHREW_API_URL" ]; then
    export METASHREW_API_URL="http://localhost:8085/"
    echo "Using local Metashrew API at $METASHREW_API_URL"
fi

# Check for dependencies
if ! command -v ts-node &> /dev/null
then
    echo "ts-node is required but not installed. Please install with: npm install -g ts-node"
    exit 1
fi

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

echo "Starting Debshrew Dashboard..."
echo "Press Ctrl+C to stop"

# Start the dashboard
ts-node debshrew_core/runtime/dashboard.ts
