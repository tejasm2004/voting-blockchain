# PowerShell script to run the Decentralized Voting System

$ErrorActionPreference = "Stop"

$nodePath = "C:\Users\Tejas\AppData\Local\Programs\nodejs"
$pyPath = "C:\Users\Tejas\AppData\Local\Programs\Python\Python311"
$pyScripts = "C:\Users\Tejas\AppData\Local\Programs\Python\Python311\Scripts"
$env:Path = "$pyPath;$pyScripts;$nodePath;$env:Path"

$projectRoot = $PSScriptRoot

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Starting Decentralized Voting System " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Start Ganache
Write-Host "[1/3] Starting Ganache on port 7545..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:Path = '$nodePath;' + `$env:Path; cd '$projectRoot'; npx ganache --port 7545 --networkId 5777 --wallet.deterministic"

Start-Sleep -Seconds 3

# 2. Start FastAPI Database Server
Write-Host "[2/3] Starting Database API on port 8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:Path = '$pyPath;$pyScripts;' + `$env:Path; cd '$projectRoot\Database_API'; python -m uvicorn main:app --host 127.0.0.1 --port 8000"

Start-Sleep -Seconds 2

# 3. Start Web App
Write-Host "[3/3] Starting Express Web App on port 8080..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:Path = '$nodePath;' + `$env:Path; cd '$projectRoot'; node index.js"

Start-Sleep -Seconds 2

Write-Host "`nAll services started!" -ForegroundColor Yellow
Write-Host "Web Application: http://localhost:8080" -ForegroundColor Cyan
Write-Host "Database API:    http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "Ganache RPC:     http://127.0.0.1:7545" -ForegroundColor Cyan
Write-Host "`nDefault Test Accounts:" -ForegroundColor Yellow
Write-Host "  Admin: voter_id = admin,  password = admin123"
Write-Host "  User:  voter_id = voter1, password = password123"
Write-Host "  User:  voter_id = voter2, password = password123"
