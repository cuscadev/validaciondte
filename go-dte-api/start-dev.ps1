# Arranca la API Go con Supabase para desarrollo local.
# Debe mostrar: "postgres: SUPABASE_DB_URL configurada" y Handlers ~34 (no 18).

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        $parts = $_ -split '=', 2
        if ($parts.Count -eq 2) {
            [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
        }
    }
    Write-Host "Variables cargadas desde .env"
}

if (-not $env:SUPABASE_DB_URL) {
    Write-Host "ERROR: SUPABASE_DB_URL no definida. Revisa go-dte-api/.env" -ForegroundColor Red
    exit 1
}

go run ./cmd/api
