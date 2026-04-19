#!/bin/bash

# Simple worker that starts both backend and frontend for systemd
# This script will manage the lifecycle of both node processes

cleanup() {
    echo "Stopping migra services..."
    kill $(jobs -p)
    exit
}

trap cleanup SIGINT SIGTERM

echo "Starting Migra (Backend + Frontend)..."
npm run start
