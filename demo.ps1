# demo.ps1
# Script de demostracion rapida: levanta el sistema, prueba lo esencial, y limpia.
# Uso: .\demo.ps1

$ErrorActionPreference = "Stop"
$compose = "docker\docker-compose.test.yml"

function Section($title) {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host " $title" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
}

# ---------------------------------------------------------------
Section "1. Levantando el sistema completo (infra + microservicios)"
docker compose -f $compose --profile app up -d --build

Write-Host "Esperando a que los servicios esten listos..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# ---------------------------------------------------------------
Section "2. Health checks"
Write-Host "--- API Gateway ---" -ForegroundColor Green
Invoke-RestMethod -Uri "http://localhost:3000/health" | ConvertTo-Json -Depth 5

Write-Host "`n--- User Service (Postgres + Redis + RabbitMQ) ---" -ForegroundColor Green
Invoke-RestMethod -Uri "http://localhost:3001/health" | ConvertTo-Json

Write-Host "`n--- Product Service ---" -ForegroundColor Green
Invoke-RestMethod -Uri "http://localhost:3002/health" | ConvertTo-Json

# ---------------------------------------------------------------
Section "3. Crear un usuario via el Gateway (circuit breaker + Postgres + RabbitMQ)"
$body = @{ name = "Demo User"; email = "demo-$(Get-Date -UFormat %s)@example.com" } | ConvertTo-Json
$user = Invoke-RestMethod -Uri "http://localhost:3000/users" -Method Post -Body $body -ContentType "application/json"
$user | ConvertTo-Json

# ---------------------------------------------------------------
Section "4. Obtener el usuario (primera vez: database, segunda vez: cache)"
Write-Host "--- Primera consulta ---" -ForegroundColor Green
Invoke-RestMethod -Uri "http://localhost:3001/users/$($user.id)" | ConvertTo-Json
Write-Host "`n--- Segunda consulta (deberia venir de cache) ---" -ForegroundColor Green
Invoke-RestMethod -Uri "http://localhost:3001/users/$($user.id)" | ConvertTo-Json

# ---------------------------------------------------------------
Section "5. Listar productos"
Invoke-RestMethod -Uri "http://localhost:3002/products" | ConvertTo-Json

# ---------------------------------------------------------------
Section "6. Metricas Prometheus del Gateway (formato real, primeras lineas)"
(Invoke-WebRequest -Uri "http://localhost:3000/metrics").Content -split "`n" | Select-Object -First 15

# ---------------------------------------------------------------
Section "Demo completa. Contenedores siguen corriendo."
Write-Host "Para apagar todo: docker compose -f $compose down -v" -ForegroundColor Yellow