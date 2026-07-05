Add-Type -AssemblyName System.Drawing

$src = "d:\app\logovietnhat_1.png"
$tmpDir = "d:\app\pwa-icons-out"

if (-not (Test-Path $tmpDir)) { New-Item -ItemType Directory -Path $tmpDir | Out-Null }

# Read source logo
$srcImg = [System.Drawing.Image]::FromFile($src)
Write-Host ("Source size: {0}x{1}" -f $srcImg.Width, $srcImg.Height)

function Save-Resized($img, $size, $destPath, $bgColor, $paddingPercent) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear($bgColor)

    # Compute draw rectangle with optional padding (maskable icon safe area)
    $padW = [int]($size * $paddingPercent)
    $padH = [int]($size * $paddingPercent)
    $drawW = $size - 2 * $padW
    $drawH = $size - 2 * $padH

    # Maintain aspect ratio
    $srcRatio = $img.Width / [double]$img.Height
    if ($srcRatio -gt 1) {
        $finalW = $drawW
        $finalH = [int]($drawW / $srcRatio)
    } else {
        $finalH = $drawH
        $finalW = [int]($drawH * $srcRatio)
    }
    $offX = [int](($size - $finalW) / 2)
    $offY = [int](($size - $finalH) / 2)

    $g.DrawImage($img, $offX, $offY, $finalW, $finalH)
    $tmpPath = Join-Path $tmpDir ([System.IO.Path]::GetFileName($destPath))
    $bmp.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host ("Saved: " + $tmpPath)
}

# Standard icons (any): white background, no padding
Save-Resized $srcImg 192 (Join-Path $tmpDir "icon-192.png") ([System.Drawing.Color]::White) 0.0
Save-Resized $srcImg 512 (Join-Path $tmpDir "icon-512.png") ([System.Drawing.Color]::White) 0.0

# Maskable icon: brand-red background, 20% safe-area padding
$brandRed = [System.Drawing.Color]::FromArgb(255, 239, 27, 45)
Save-Resized $srcImg 512 (Join-Path $tmpDir "icon-maskable-512.png") $brandRed 0.20

$srcImg.Dispose()
Write-Host "Done."
