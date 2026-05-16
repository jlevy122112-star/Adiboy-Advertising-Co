$root = Split-Path $PSScriptRoot -Parent
$p = Join-Path $root 'README.md'
$lines = [System.IO.File]::ReadAllLines($p)
function Col2($line) {
  $m = [regex]::Match($line, '^\|[^|]+\|([^|]+)\|')
  if ($m.Success) { return $m.Groups[1].Value }
  return $null
}
function Col3($line) {
  $m = [regex]::Match($line, '^\|[^|]+\|[^|]+\|(.+)\|$')
  if ($m.Success) { return $m.Groups[1].Value }
  return $null
}
for ($i = 0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match '^\| # \| Mode') {
    for ($j = $i; $j -le $i + 5; $j++) {
      $c2 = Col2 $lines[$j]
      $c3 = Col3 $lines[$j]
      if ($c2) { Write-Output ("Line {0} col2={1} col3={2}" -f ($j + 1), $c2.Length, $c3.Length) }
    }
    break
  }
}
