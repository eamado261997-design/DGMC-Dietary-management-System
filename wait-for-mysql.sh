#!/bin/bash
# Wait for MySQL to be ready before starting the app

MYSQL_HOST=${MYSQL_HOST:-dgmc_mysql}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}

echo "Waiting for MySQL to be ready at $MYSQL_HOST:$MYSQL_PORT..."

max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
  if mysqladmin ping -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" --silent 2>/dev/null; then
    echo "MySQL is ready!"
    break
  fi
  
  echo "Attempt $attempt/$max_attempts: MySQL not ready yet. Waiting 2 seconds..."
  sleep 2
  attempt=$((attempt + 1))
done

if [ $attempt -gt $max_attempts ]; then
  echo "ERROR: MySQL did not become ready after $max_attempts attempts"
  exit 1
fi

echo "Starting application..."
node --no-warnings dist/server.cjs
