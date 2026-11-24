$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# This is a build-time export tool; the app only uses the generated resources.
$res = Join-Path $PSScriptRoot '../app/src/main/res'
[xml]$palette = Get-Content -LiteralPath (Join-Path $res 'values/ic_launcher_background.xml') -Raw
$background = [Drawing.ColorTranslator]::FromHtml($palette.resources.color.InnerText)
$source = [Drawing.Bitmap]::new((Join-Path $PSScriptRoot 'launcher-star.png'))
$densities = [ordered]@{ mdpi = 1; hdpi = 1.5; xhdpi = 2; xxhdpi = 3; xxxhdpi = 4 }

function Export-Icon($path, [int]$size, [float]$coverage, $shape) {
    $bitmap = [Drawing.Bitmap]::new($size, $size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $mask = [Drawing.Drawing2D.GraphicsPath]::new()
    $brush = [Drawing.SolidBrush]::new($background)
    try {
        $graphics.SmoothingMode = 'AntiAlias'
        $graphics.InterpolationMode = 'HighQualityBicubic'
        $graphics.PixelOffsetMode = 'HighQuality'
        $graphics.Clear([Drawing.Color]::Transparent)

        if ($shape) {
            [float]$edge = $size * 0.04
            [float]$side = $size - 2 * $edge
            if ($shape -eq 'round') {
                $mask.AddEllipse($edge, $edge, $side, $side)
            } else {
                [float]$corner = $side * 0.48
                [float]$far = $size - $edge - $corner
                $mask.AddArc($edge, $edge, $corner, $corner, 180, 90)
                $mask.AddArc($far, $edge, $corner, $corner, 270, 90)
                $mask.AddArc($far, $far, $corner, $corner, 0, 90)
                $mask.AddArc($edge, $far, $corner, $corner, 90, 90)
                $mask.CloseFigure()
            }
            $graphics.FillPath($brush, $mask)
        }

        $scale = $size * $coverage / [Math]::Max($crop.Width, $crop.Height)
        $width = $crop.Width * $scale
        $height = $crop.Height * $scale
        $frame = [Drawing.RectangleF]::new(($size - $width) / 2, ($size - $height) / 2, $width, $height)
        $graphics.DrawImage($source, $frame, $crop, [Drawing.GraphicsUnit]::Pixel)
        $bitmap.Save($path, [Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $brush.Dispose()
        $mask.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

try {
    # Find the opaque subject, leaving a few pixels for its antialiased edge.
    $left = $source.Width
    $top = $source.Height
    $right = -1
    $bottom = -1
    for ($y = 0; $y -lt $source.Height; $y += 2) {
        for ($x = 0; $x -lt $source.Width; $x += 2) {
            if ($source.GetPixel($x, $y).A -gt 128) {
                $left = [Math]::Min($left, $x)
                $top = [Math]::Min($top, $y)
                $right = [Math]::Max($right, $x)
                $bottom = [Math]::Max($bottom, $y)
            }
        }
    }
    if ($right -lt 0) { throw 'No opaque artwork found in launcher-star.png.' }
    $crop = [Drawing.Rectangle]::FromLTRB(
        [Math]::Max(0, $left - 8), [Math]::Max(0, $top - 8),
        [Math]::Min($source.Width, $right + 9), [Math]::Min($source.Height, $bottom + 9)
    )
    foreach ($density in $densities.GetEnumerator()) {
        $output = Join-Path $res "mipmap-$($density.Key)"
        # The whole silhouette fits inside the circular 66 dp safe zone.
        Export-Icon (Join-Path $output 'ic_launcher_foreground.png') (108 * $density.Value) (57 / 108) $null
        Export-Icon (Join-Path $output 'ic_launcher.png') (48 * $density.Value) 0.76 'rounded'
        Export-Icon (Join-Path $output 'ic_launcher_round.png') (48 * $density.Value) 0.76 'round'
    }
} finally {
    $source.Dispose()
}
