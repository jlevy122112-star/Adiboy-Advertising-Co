$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$p = Join-Path $root 'README.md'
$lines = [System.IO.File]::ReadAllLines($p)

$start = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match '^\| # \|') { $start = $i; break }
}
if ($start -lt 0) { Write-Error 'Table header not found.'; exit 1 }

$w2 = 34
$w3 = 72

function PadCell([string]$text, [int]$width) {
  if ($text.Length -ge $width) { return $text.Substring(0, $width) }
  return $text.PadRight($width)
}

$headerMode = PadCell(' Mode', $w2)
$sep2 = ''.PadLeft($w2, '-')
$sep3 = ''.PadLeft($w3, '-')

$row1Mode = PadCell(' **`user_only`**', $w2)
$row2Mode = PadCell(' **`ai_with_optional_override`**', $w2)
$row3Mode = PadCell(' **`user_with_ai_assist`**', $w2)
$row4Mode = PadCell(' **`ai_suggest_user_confirm`**', $w2)

$m1 = PadCell(' User must pick. The AI is **not** involved in this decision.', $w3)
$m2 = PadCell(' AI auto-applies a value; the user can edit it at any time.', $w3)
$m3 = PadCell(' User picks; user can ask the AI for suggestions on demand.', $w3)
$m4 = PadCell(' AI proposes options; the user confirms, edits, or replaces each one.', $w3)

$newRows = @(
  ('| # |' + $headerMode + '|' + $m1 + '|'),
  ('|---|' + $sep2 + '|' + $sep3 + '|'),
  ('| 1 |' + $row1Mode + '|' + $m1 + '|'),
  ('| 2 |' + $row2Mode + '|' + $m2 + '|'),
  ('| 3 |' + $row3Mode + '|' + $m3 + '|'),
  ('| 4 |' + $row4Mode + '|' + $m4 + '|')
)

for ($i = 0; $i -lt 6; $i++) {
  $lines[$start + $i] = $newRows[$i]
}

$raw = [System.IO.File]::ReadAllText($p)
$nl = $(if ($raw.Contains("`r`n")) { "`r`n" } else { "`n" })
[System.IO.File]::WriteAllText($p, (($lines -join $nl) + $nl))
Write-Host 'README table rebuilt with aligned columns.'
