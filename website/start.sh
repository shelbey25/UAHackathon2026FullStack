#!/usr/bin/env bash
# SentinelSupply — one-click local dev startup
set -e

echo "🚀 Starting SentinelSupply Command Center..."

# 1. Postgres
if ! docker ps --format '{{.Names}}' | grep -q sentinel_pg; then
  echo "📦 Starting PostgreSQL..."
  docker run -d --name sentinel_pg \
    -p 5432:5432 \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=sentinelsupply \
    postgres:16
  echo "⏳ Waiting for Postgres to be ready..."
  sleep 5
fi

# 2. ML Service
echo "🧠 Starting ML service (background)..."
cd command-center-ml
if [ ! -d venv ]; then
  python3 -m venv venv
  source venv/bin/activate
  pip install -q -r requirements.txt
  python -m spacy download en_core_web_sm
else
  source venv/bin/activate
fi
uvicorn app.main:app --port 8000 --reload &
ML_PID=$!
cd ..

# 3. API + Seed
echo "⚙️  Starting API gateway..."
cd command-center-api
npm install --silent
npx prisma migrate dev --name init --skip-seed 2>/dev/null || true
node src/prisma/seed.js
npm run dev &
API_PID=$!
cd ..

# 4. Client
echo "🖥  Starting Next.js client..."
cd command-center-client
npm install --silent
npm run dev &
CLIENT_PID=$!
cd ..

echo ""
echo "✅  All services started!"
echo "   Frontend : http://localhost:3000"
echo "   API      : http://localhost:4000"
echo "   ML       : http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all services."
trap "kill $ML_PID $API_PID $CLIENT_PID 2>/dev/null; echo 'Stopped.'" INT
wait
