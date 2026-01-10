#!/bin/bash
# Quick API health check using curl
# Run this after starting the worker manager

BASE_URL="http://localhost:3001"

echo "🔍 Quick Health Check for Worker Layer"
echo "======================================"

# Check health
echo -e "\n1. Checking /health..."
curl -s $BASE_URL/health | python3 -m json.tool 2>/dev/null || curl -s $BASE_URL/health

# List workers
echo -e "\n\n2. Listing /workers..."
curl -s $BASE_URL/workers | python3 -m json.tool 2>/dev/null || curl -s $BASE_URL/workers

# Check capabilities
echo -e "\n\n3. Available /capabilities..."
curl -s $BASE_URL/capabilities | python3 -m json.tool 2>/dev/null || curl -s $BASE_URL/capabilities

# Test task assignment
echo -e "\n\n4. Testing task assignment..."
curl -s -X POST $BASE_URL/tasks/assign \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "quick_test_'$(date +%s)'",
    "requiredCapability": "research",
    "payload": {
      "action": "summarize",
      "content": "Quick test content"
    }
  }' | python3 -m json.tool 2>/dev/null || echo "Task submitted"

echo -e "\n\n======================================"
echo "✅ Quick check complete!"