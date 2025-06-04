#!/bin/bash

# start-debshrew-runtime.sh
# Script to start the Debshrew runtime service for CDC processing

# Change to project root directory
cd "$(dirname "$0")/.."

# Check for dependencies
if ! command -v ts-node &> /dev/null
then
    echo "ts-node is required but not installed. Please install with: npm install -g ts-node"
    exit 1
fi

# Check if Neo4j is running
echo "Checking if Neo4j is running..."
if ! curl -s http://localhost:7474 > /dev/null; then
    echo "Neo4j doesn't appear to be running. Would you like to start it? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        ./scripts/manage-neo4j.sh start
    else
        echo "Neo4j is required for the Debshrew runtime. Exiting."
        exit 1
    fi
fi

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Set environment variables for local Metashrew instance if not already set
if [ -z "$METASHREW_API_URL" ]; then
    export METASHREW_API_URL="http://localhost:8085/"
    echo "Using local Metashrew API at $METASHREW_API_URL"
fi

if [ -z "$METASHREW_WS_URL" ]; then
    export METASHREW_WS_URL="ws://localhost:8085/"
    echo "Using local Metashrew WebSocket at $METASHREW_WS_URL"
fi

# Check if Metashrew is running on port 8085
echo "Checking if Metashrew is running on port 8085..."
if ! curl -s http://localhost:8085/health > /dev/null; then
    echo "⚠️ Warning: Metashrew doesn't appear to be running on port 8085."
    echo "Please make sure your rockshrew-mono instance is running before continuing."
    echo "Continue anyway? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Exiting."
        exit 1
    fi
fi

echo "Starting Debshrew runtime service..."
echo "Press Ctrl+C to stop"

# Start the runtime
ts-node debshrew_core/runtime/debshrew-runtime.ts
