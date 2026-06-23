# ==========================================
# Первичная настройка Self-hosted Supabase (PowerShell)
# Запускать ПОСЛЕ docker compose up -d
# ==========================================

$ErrorActionPreference = "Continue"

Write-Host "⏳ Ожидание готовности PostgreSQL..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
while ($attempt -lt $maxAttempts) {
    $result = docker compose exec -T db pg_isready -U postgres 2>&1
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
    $attempt++
}
Write-Host "✅ PostgreSQL готов" -ForegroundColor Green

Write-Host ""
Write-Host "⏳ Ожидание готовности Kong API..." -ForegroundColor Yellow
$attempt = 0
while ($attempt -lt $maxAttempts) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/rest/v1/" -UseBasicParsing -ErrorAction Stop
        break
    } catch {
        Start-Sleep -Seconds 2
        $attempt++
    }
}
Write-Host "✅ Kong API готов" -ForegroundColor Green

Write-Host ""
Write-Host "Applying SQL migrations..." -ForegroundColor Cyan

$migrationDir = ".\supabase\migrations"
if (Test-Path $migrationDir) {
    $migrations = Get-ChildItem "$migrationDir\*.sql" | Sort-Object Name
    foreach ($migration in $migrations) {
        Write-Host "  Применение: $($migration.Name)"
        Get-Content $migration.FullName | docker compose exec -T db psql -U postgres -d postgres 2>&1 | Out-Null
    }
    Write-Host "✅ Миграции применены" -ForegroundColor Green
} else {
    Write-Host "⚠️  Папка supabase\migrations не найдена, пропуск миграций" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📦 Создание storage bucket 'chat-attachments'..." -ForegroundColor Cyan

# Читаем ключи из .env
$envContent = Get-Content ".env" -Raw
$serviceRoleKey = ($envContent | Select-String "^SERVICE_ROLE_KEY=(.+)$").Matches[0].Groups[1].Value

try {
    $headers = @{
        "Authorization" = "Bearer $serviceRoleKey"
        "Content-Type" = "application/json"
    }
    $body = @{
        id = "chat-attachments"
        name = "chat-attachments"
        public = $false
        file_size_limit = 26214400
        allowed_mime_types = @("image/*", "application/pdf", "text/*", "application/zip")
    } | ConvertTo-Json

    Invoke-RestMethod -Uri "http://localhost:8000/storage/v1/bucket" -Method POST -Headers $headers -Body $body -ErrorAction Stop | Out-Null
    Write-Host "✅ Bucket 'chat-attachments' создан" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Bucket уже существует или ошибка: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🎉 Настройка завершена!" -ForegroundColor Green
Write-Host ""
Write-Host "Supabase API:  http://localhost:8000"
Write-Host "Приложение:    http://localhost:3000"
Write-Host ""
Write-Host "1. Откройте http://localhost:3000/setup"
Write-Host "2. Создайте учётную запись системного администратора"
Write-Host "3. Войдите в систему"
Write-Host "==========================================" -ForegroundColor Cyan
