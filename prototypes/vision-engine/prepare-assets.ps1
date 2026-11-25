# Bereitet die fünf Originalbilder und die beiden Klangebenen für den Prototyp vor.
# Die Dateien landen in prototypes/vision-engine/local-assets/ (per .gitignore ausgeschlossen, nie im Repository).
# Die PNG-Originale werden unverändert in Größe und Bildausschnitt als JPEG (Qualität 90) gespeichert, nur kleiner in der Datei.
#
# Aufruf aus dem Repository:
#   powershell -ExecutionPolicy Bypass -File prototypes/vision-engine/prepare-assets.ps1
#   powershell -ExecutionPolicy Bypass -File prototypes/vision-engine/prepare-assets.ps1 -Source 'D:\Pfad\zu\Emil'
param(
  [string]$Source = (Join-Path $env:USERPROFILE 'Desktop\ChroniPlay Projekt\Emil'),
  [int]$Quality = 90
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$target = Join-Path $PSScriptRoot 'local-assets'
New-Item -ItemType Directory -Force -Path $target | Out-Null

$images = @(
  @{ src = 'ChatGPT-Bild 21. Nov. 2026, 02_03_42-1.png'; dst = 'hunger-1.jpg'; label = 'Auf dem Heimweg' },
  @{ src = 'ChatGPT-Bild 21. Nov. 2026, 02_04_02-2.png'; dst = 'hunger-2.jpg'; label = 'Die Passantin' },
  @{ src = 'ChatGPT-Bild 21. Nov. 2026, 02_04_24-3.png'; dst = 'hunger-3.jpg'; label = 'Unter der Brücke' },
  @{ src = 'ChatGPT-Bild 21. Nov. 2026, 02_04_34-4.png'; dst = 'hunger-4.jpg'; label = 'Brot und Wasser' },
  @{ src = 'ChatGPT-Bild 21. Nov. 2026, 02_04_47-5.png'; dst = 'hunger-5.jpg'; label = 'Die Hände' }
)
$audio = @(
  @{ src = 'dark Cinematic Ambient, Supernatural Psychological Horror, Haunting Orchestr.wav'; dst = 'hunger-atmosphaere.wav'; label = 'Atmosphäre: Psychologischer Horror' },
  @{ src = 'supernatural Memory Distortion Ambience. Deep Muffled Heartbeat, Cold Wind P.wav'; dst = 'hunger-herzschlag.wav'; label = 'Erinnerung: gedämpfter Herzschlag' }
)

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$Quality)

$manifest = @{ images = @(); audio = @() }
foreach ($i in $images) {
  $in = Join-Path $Source $i.src
  if (-not (Test-Path -LiteralPath $in)) { Write-Warning "Fehlt: $in"; continue }
  $out = Join-Path $target $i.dst
  $img = [System.Drawing.Image]::FromFile($in)
  try { $img.Save($out, $codec, $params); $w = $img.Width; $h = $img.Height } finally { $img.Dispose() }
  $manifest.images += @{ file = $i.dst; label = $i.label; vision = 'der-hunger-folgt-dir'; width = $w; height = $h; bytes = (Get-Item -LiteralPath $out).Length }
  Write-Host ("Bild  {0,-16} {1}x{2}  {3:N0} KB" -f $i.dst, $w, $h, ((Get-Item -LiteralPath $out).Length / 1KB))
}
foreach ($a in $audio) {
  $in = Join-Path $Source $a.src
  if (-not (Test-Path -LiteralPath $in)) { Write-Warning "Fehlt: $in"; continue }
  $out = Join-Path $target $a.dst
  Copy-Item -LiteralPath $in -Destination $out -Force
  $manifest.audio += @{ file = $a.dst; label = $a.label; bytes = (Get-Item -LiteralPath $out).Length }
  Write-Host ("Ton   {0,-24} {1:N0} KB" -f $a.dst, ((Get-Item -LiteralPath $out).Length / 1KB))
}
$json = $manifest | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText((Join-Path $target 'manifest.json'), $json, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Fertig: $target"
