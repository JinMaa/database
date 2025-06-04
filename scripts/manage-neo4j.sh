#!/bin/bash
# manage-neo4j.sh
# 
# Script for managing Neo4j with APOC plugins
# This allows for efficient database operations including clean resets

set -e

# Base directory is the project root
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BASE_DIR"

# Default values
COMMAND="help"

# Read command line arguments
if [ $# -gt 0 ]; then
  COMMAND="$1"
  shift
fi

# Function to display usage information
show_help() {
  echo "Neo4j Management Script"
  echo "======================="
  echo "Usage: $0 <command>"
  echo ""
  echo "Commands:"
  echo "  start         - Start the Neo4j container"
  echo "  stop          - Stop the Neo4j container"
  echo "  restart       - Restart the Neo4j container"
  echo "  reset         - Delete all data and restart with a clean database"
  echo "  clean         - Use APOC to clear all nodes and relationships (keeps database)"
  echo "  status        - Show Neo4j container status"
  echo "  logs          - Show Neo4j container logs"
  echo "  shell         - Open a shell in the Neo4j container"
  echo "  help          - Show this help message"
  echo ""
}

# Function to start the Neo4j container
start_neo4j() {
  echo "Starting Neo4j container..."
  docker-compose up -d neo4j
  echo "Waiting for Neo4j to become ready..."
  wait_for_neo4j
  echo "✅ Neo4j started successfully"
  update_env_file
}

# Function to stop the Neo4j container
stop_neo4j() {
  echo "Stopping Neo4j container..."
  docker-compose stop neo4j
  echo "✅ Neo4j stopped"
}

# Function to restart the Neo4j container
restart_neo4j() {
  echo "Restarting Neo4j container..."
  docker-compose restart neo4j
  echo "Waiting for Neo4j to become ready..."
  wait_for_neo4j
  echo "✅ Neo4j restarted successfully"
}

# Function to completely reset Neo4j (deletes all data)
reset_neo4j() {
  echo "WARNING: This will delete all Neo4j data. Are you sure? (y/N)"
  read -r response
  if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "Stopping Neo4j container..."
    docker-compose down -v
    echo "Removing Neo4j volumes..."
    docker volume rm protostone-processor_neo4j_data protostone-processor_neo4j_logs protostone-processor_neo4j_plugins protostone-processor_neo4j_import 2>/dev/null || true
    echo "Starting Neo4j with clean data..."
    docker-compose up -d neo4j
    echo "Waiting for Neo4j to become ready..."
    wait_for_neo4j
    echo "✅ Neo4j reset successfully with clean data"
    update_env_file
  else
    echo "Neo4j reset cancelled"
  fi
}

# Function to clean all data using APOC (keeps database structure)
clean_neo4j() {
  echo "Cleaning all nodes and relationships in Neo4j..."
  docker-compose exec neo4j cypher-shell -u neo4j -p password "CALL apoc.periodic.iterate('MATCH (n) RETURN n', 'DETACH DELETE n', {batchSize: 1000, parallel: true})"
  echo "✅ Neo4j database cleaned successfully"
}

# Function to show Neo4j container status
show_status() {
  echo "Neo4j container status:"
  docker-compose ps neo4j
}

# Function to show Neo4j container logs
show_logs() {
  echo "Neo4j container logs:"
  docker-compose logs --tail=100 neo4j
}

# Function to open a shell in the Neo4j container
open_shell() {
  echo "Opening shell in Neo4j container..."
  docker-compose exec neo4j bash
}

# Function to wait for Neo4j to become ready
wait_for_neo4j() {
  local max_attempts=30
  local attempt=0
  
  while [ $attempt -lt $max_attempts ]; do
    if docker-compose exec neo4j cypher-shell -u neo4j -p password "RETURN 1;" > /dev/null 2>&1; then
      return 0
    fi
    
    attempt=$((attempt + 1))
    echo "Waiting for Neo4j to become ready ($attempt/$max_attempts)..."
    sleep 3
  done
  
  echo "Error: Neo4j did not become ready within the timeout"
  return 1
}

# Function to update .env file with Neo4j connection details
update_env_file() {
  local env_file=".env"
  
  # Check if .env file exists
  if [ ! -f "$env_file" ]; then
    echo "Creating new .env file..."
    touch "$env_file"
  fi
  
  # Check if Neo4j environment variables already exist
  if grep -q "NEO4J_URI" "$env_file"; then
    echo "Neo4j environment variables already exist in .env file"
  else
    echo "Updating .env file with Neo4j connection details..."
    cat << EOF >> "$env_file"

# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
EOF
    echo "✅ .env file updated"
  fi
}

# Execute the specified command
case "$COMMAND" in
  start)
    start_neo4j
    ;;
  stop)
    stop_neo4j
    ;;
  restart)
    restart_neo4j
    ;;
  reset)
    reset_neo4j
    ;;
  clean)
    clean_neo4j
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs
    ;;
  shell)
    open_shell
    ;;
  help|*)
    show_help
    ;;
esac
