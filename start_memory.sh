#!/bin/bash
echo "Starting ChromaDB Server..."
# Check if docker is available
if command -v docker &> /dev/null; then
    docker run -p 8000:8000 chromadb/chroma
else
    echo "Docker not found. Attempting local python run..."
    pip install chromadb
    chroma run --path ./chroma_db
fi
