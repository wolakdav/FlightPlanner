#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/Backend"
FRONTEND_DIR="$ROOT_DIR/FrontEnd"
LOG_DIR="$ROOT_DIR/.logs"

mkdir -p "$LOG_DIR"

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command not found: $cmd" >&2
    exit 1
  fi
}

require_command redis-server
require_command python3
require_command npm

start_redis() {
  if command -v redis-cli >/dev/null 2>&1 && redis-cli ping >/dev/null 2>&1; then
    echo "Redis is already running."
    return
  fi

  # Mirror Backend/README intent: set overcommit_memory before starting Redis when possible.
  if [[ "$(id -u)" -eq 0 ]]; then
    sysctl vm.overcommit_memory=1 >/dev/null
  elif command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    sudo sysctl vm.overcommit_memory=1 >/dev/null
  else
    echo "Warning: unable to run sysctl vm.overcommit_memory=1 (no root/sudo). Continuing."
  fi

  redis-server --daemonize yes
  echo "Started Redis in daemon mode."
}

cleanup() {
  local exit_code=$?

  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi

  exit "$exit_code"
}

trap cleanup EXIT INT TERM

start_redis

echo "Loading backend airport data into Redis..."
(
  cd "$BACKEND_DIR"
  python3 src/scripts/loadDataToRedis.py
)

echo "Starting backend API on http://localhost:5000 ..."
(
  cd "$BACKEND_DIR"
  python3 -m flask --app src/app.py run --host 0.0.0.0 --port 5000
) >"$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

echo "Ensuring frontend dependencies are installed..."
(
  cd "$FRONTEND_DIR"
  npm install
)

echo "Starting frontend dev server on http://localhost:5173 ..."
(
  cd "$FRONTEND_DIR"
  npm run dev -- --host 0.0.0.0 --port 5173
) >"$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

echo
echo "FlightPlanner development stack is starting."
echo "Backend PID : $BACKEND_PID (logs: .logs/backend.log)"
echo "Frontend PID: $FRONTEND_PID (logs: .logs/frontend.log)"
echo
echo "Press Ctrl+C to stop backend and frontend processes started by this script."

wait "$BACKEND_PID" "$FRONTEND_PID"
