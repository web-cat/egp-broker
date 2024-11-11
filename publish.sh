#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Variables
REPO="docker.cs.vt.edu/stedwar2/egp-broker"
IMAGE1_NAME="frontend_prod"
IMAGE2_NAME="backend_prod"
IMAGE1_DOCKERFILE="frontend/Dockerfile.frontend" 
IMAGE2_DOCKERFILE="backend/Dockerfile.backend"
TARGET="prod"

if [[ -f .env ]]; then
  source .env
else
  echo ".env file not found. Please create one with the required variables."
  exit 1
fi

echo "Logging into Docker..."
echo "$DOCKER_PASSWORD" | docker login docker.cs.vt.edu -u "$DOCKER_USERNAME" --password-stdin
if [[ $? -ne 0 ]]; then
  echo "Docker login failed. Check your username and password."
  exit 1
fi
echo "Docker login successful."

if [[ -n $(git status --porcelain) ]]; then
  echo "There are uncommitted changes. Please commit or stash them before building the Docker images."
  exit 1
fi

COMMIT_HASH=$(git rev-parse --short HEAD)

build_and_push() {
  IMAGE_NAME=$1
  DOCKERFILE=$2
  CONTEXT=$3
  echo "Building and pushing image: $IMAGE_NAME using Dockerfile: $DOCKERFILE with target: $TARGET"

  # Build the Docker image with the specified Dockerfile and target
  docker build --target $TARGET -f $DOCKERFILE -t $REPO/$IMAGE_NAME:latest -t $REPO/$IMAGE_NAME:$COMMIT_HASH $CONTEXT --platform=linux/amd64

  # Push both tags to the repository
  docker push $REPO/$IMAGE_NAME:latest
  docker push $REPO/$IMAGE_NAME:$COMMIT_HASH

  echo "Image $IMAGE_NAME built and pushed successfully!"
}

build_and_push $IMAGE1_NAME $IMAGE1_DOCKERFILE ./frontend
build_and_push $IMAGE2_NAME $IMAGE2_DOCKERFILE ./backend

echo "Both Docker images with target '$TARGET' have been built and pushed!"
echo "Tags: latest, $COMMIT_HASH"


