$ErrorActionPreference = "Stop"
$srcDir = "d:\app\pwa-icons-out"
$dstDir = Join-Path (Get-Location) "public"
Write-Host "Working dir: $(Get-Location)"
Write-Host "Source: $srcDir"
Write-Host "Dest: $dstDir"

foreach ($f in @("icon-192.png","icon-512.png","icon-maskable-512.png")) {
    $src = Join-Path $srcDir $f
    $dst = Join-Path $dstDir $f
    Write-Host "Copy: $src -> $dst"
    Copy-Item -Path $src -Destination $dst -Force
}
Write-Host "Done."
Get-ChildItem -Path $dstDir | Select-Object Name, Length
