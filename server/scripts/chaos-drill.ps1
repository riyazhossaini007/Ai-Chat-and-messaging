$ErrorActionPreference = "Stop"

param(
  [string]$ApiBaseUrl = "http://localhost:5000",
  [string]$AdminToken = "",
  [string]$ModelToDisable = "grok"
)

if (-not $AdminToken) {
  Write-Error "AdminToken is required"
}

$headers = @{
  Authorization = "Bearer $AdminToken"
  "Content-Type" = "application/json"
}

Write-Host "1) Provider failover drill: disable model $ModelToDisable"
$body = @{
  reason = "Chaos drill: provider failover validation"
  enabledModels = @{ $ModelToDisable = $false }
  requestId = [guid]::NewGuid().ToString()
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Patch -Uri "$ApiBaseUrl/ai/admin/config" -Headers $headers -Body $body | Out-Null
Write-Host "Model disabled. Trigger a few chat requests and verify fallback UX."

Write-Host "2) Redis outage drill guidance:"
Write-Host "- Stop Redis or set REDIS_REST_TOKEN invalid and restart server."
Write-Host "- Verify /readyz returns 503 and rate-limit paths fail closed in production."

Write-Host "3) DB slow query drill guidance:"
Write-Host "- Use DB proxy/pg_sleep at infra layer to introduce latency."
Write-Host "- Verify provider fallback still works and alerts are fired."

Write-Host "4) Gather alerts + metrics after drill"
Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/ops/alerts?limit=50" -Headers $headers | ConvertTo-Json -Depth 8 | Write-Output
Invoke-RestMethod -Method Get -Uri "$ApiBaseUrl/ops/metrics/live?hours=1" -Headers $headers | ConvertTo-Json -Depth 8 | Write-Output
