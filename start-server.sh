#!/bin/bash

# Exit immediately if a command fails
set -e

# --- Setup Virtual Environment ---
# This part is the same: only create the venv if it doesn't already exist.
if [ ! -d ".venv" ]; then
  echo ">>> Virtual environment not found. Creating..."
  python -m venv .venv
else
  echo ">>> Virtual environment found."
fi

# --- Activate and Install/Sync Dependencies ---
# This block now runs EVERY time the script is executed.
echo ">>> Activating virtual environment and installing dependencies from requirements.txt..."
source .venv/bin/activate
pip install -r requirements.txt

# --- Start the Server ---
echo ">>> Starting server on port $PORT..."
uvicorn main:app --host 0.0.0.0 --port $PORT --reload