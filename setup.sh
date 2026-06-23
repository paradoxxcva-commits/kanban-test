#!/bin/bash
# ==========================================
# Первичная настройка Self-hosted Supabase
# Запускать ПОСЛЕ docker compose up -d
# ==========================================

set -e

echo "⏳ Ожидание готовности PostgreSQL..."
until docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do
  sleep 2
done
echo "✅ PostgreSQL готов"

echo ""
echo "⏳ Ожидание готовности Kong API..."
until curl -sf http://localhost:8000/rest/v1/ > /dev/null 2>&1; do
  sleep 2
done
echo "✅ Kong API готов"

echo ""
echo "📦 Применение SQL-миграций..."

MIGRATION_DIR="./supabase/migrations"
if [ -d "$MIGRATION_DIR" ]; then
  for migration in $(ls "$MIGRATION_DIR"/*.sql | sort); do
    echo "  Применение: $(basename $migration)"
    docker compose exec -T db psql -U postgres -d postgres -f "/dev/stdin" < "$migration" 2>&1 || true
  done
  echo "✅ Миграции применены"
else
  echo "⚠️  Папка supabase/migrations не найдена, пропуск миграций"
fi

echo ""
echo "📦 Создание storage bucket 'chat-attachments'..."

# Создаём bucket через Supabase Storage API
SERVICE_ROLE_KEY=$(grep SERVICE_ROLE_KEY .env | cut -d'=' -f2-)
ANON_KEY=$(grep ANON_KEY .env | cut -d'=' -f2-)

curl -sf -X POST http://localhost:8000/storage/v1/bucket \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "chat-attachments",
    "name": "chat-attachments",
    "public": false,
    "file_size_limit": 26214400,
    "allowed_mime_types": ["image/*", "application/pdf", "text/*", "application/zip"]
  }' > /dev/null 2>&1 && echo "✅ Bucket 'chat-attachments' создан" || echo "⚠️  Bucket уже существует или ошибка"

echo ""
echo "=========================================="
echo "🎉 Настройка завершена!"
echo ""
echo "Supabase API:  http://localhost:8000"
echo "Приложение:    http://localhost:3000"
echo ""
echo "1. Откройте http://localhost:3000/setup"
echo "2. Создайте учётную запись системного администратора"
echo "3. Войдите в систему"
echo "=========================================="
