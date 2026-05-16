$root = Split-Path $PSScriptRoot -Parent
$p = Join-Path $root 'README.md'
$lines = [System.IO.File]::ReadAllLines($p)
for ($i = 0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match '^\| # \| Mode') {
    for ($j = $i; $j -le $i + 5; $j++) {
      Write-Output ('--- ' + ($j + 1))
      Write-Output $lines[$j]
    }
    break
  }
}
