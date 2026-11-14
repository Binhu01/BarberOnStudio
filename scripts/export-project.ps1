$ErrorActionPreference = "Stop"
$src = "C:\Users\glaub\OneDrive\Desktop\Nexora\.claude\worktrees\hungry-proskuriakova-78f113"
$dst = "C:\Users\glaub\OneDrive\Desktop\Nexora.zip"
$tempDir = Join-Path $env:TEMP "nexora-export-$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Host "Copiando projeto para diretorio temporario..."
$excludeDirs = @("node_modules", ".next", ".git", ".claude", "screenshots")
Copy-Item -Path $src -Destination $tempDir -Recurse -Force -Exclude $excludeDirs

Write-Host "Removendo arquivos desnecessarios..."
Get-ChildItem -Path $tempDir -Recurse -Include "*.tsbuildinfo", ".env.local" -Force | Remove-Item -Force -ErrorAction SilentlyContinue
# Remover diretorios vazios que podem ter sobrado
Get-ChildItem -Path $tempDir -Directory -Recurse |
    Where-Object { $_.Name -in $excludeDirs } |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Compactando..."
if (Test-Path $dst) { Remove-Item $dst -Force }
Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $dst -Force

Write-Host "Limpando temporarios..."
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

$size = [math]::Round((Get-Item $dst).Length / 1MB, 2)
Write-Host "Concluido! Arquivo: $dst ($size MB)"