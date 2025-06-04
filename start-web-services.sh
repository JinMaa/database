#!/bin/bash
# Script to start both web-explorer and clock-in-viz services

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Web Services...${NC}"

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "tmux is required but not installed. Please install tmux first."
    exit 1
fi

# Start a new tmux session
SESSION_NAME="web-services"

# Kill existing session if it exists
tmux kill-session -t $SESSION_NAME 2>/dev/null

# Create a new session
tmux new-session -d -s $SESSION_NAME

# Split the window horizontally
tmux split-window -h -t $SESSION_NAME

# Set up web-explorer in the left pane
tmux send-keys -t $SESSION_NAME:0.0 "cd $(pwd)/web-explorer && echo -e '${GREEN}Starting Web Explorer...${NC}' && node server.js" C-m

# Set up clock-in-viz in the right pane
tmux send-keys -t $SESSION_NAME:0.1 "cd $(pwd)/clock-in-viz && echo -e '${BLUE}Starting Clock-In Visualization...${NC}' && node server.js" C-m

# Attach to the session
echo -e "${GREEN}Services started in tmux session '$SESSION_NAME'${NC}"
echo -e "${YELLOW}Web Explorer:${NC} http://localhost:3000"
echo -e "${YELLOW}Clock-In Visualization:${NC} http://localhost:3001"
echo -e "\nPress Ctrl+B then D to detach from tmux session without stopping the services"
echo -e "Run 'tmux attach -t $SESSION_NAME' to reconnect to the session later"

tmux attach -t $SESSION_NAME
