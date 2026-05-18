# Sourced by each child PowerShell window to load .env into process scope
$ef = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $ef)) { return }
Get-Content $ef | ForEach-Object {
  # Standard format:  KEY=value
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim('"').Trim("'").Trim(), "Process")
  }
  # PowerShell format: $env:KEY=value  or  $env:KEY="value"
  elseif ($_ -match '^\s*\$env:([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?(.*?)"?\s*$') {
    [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim(), "Process")
  }
}
