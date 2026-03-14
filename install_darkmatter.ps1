
$CLIDir = $PSScriptRoot
if (-not $CLIDir) { $CLIDir = Get-Location }

Write-Host "🛡️ Setting up Darkmatter CLI..." -ForegroundColor Cyan

# Add to User PATH
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$CLIDir*") {
    $NewPath = "$UserPath;$CLIDir"
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    Write-Host "✅ Added $CLIDir to User PATH." -ForegroundColor Green
} else {
    Write-Host "ℹ️ $CLIDir is already in PATH." -ForegroundColor Yellow
}

Write-Host "🚀 Installation complete! Please restart your terminal." -ForegroundColor Cyan
Write-Host "You can now run 'darkmatter' from any directory." -ForegroundColor Green
