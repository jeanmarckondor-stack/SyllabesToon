$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectDir = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $projectDir 'portable-linux'
$zipPath = Join-Path $projectDir 'SyllabesToon-Linux.zip'
$archiveRoot = 'SyllabesToon-Linux/'
$requiredFiles = @('server', 'index.html', 'teacher-manager.html', 'lancer-syllabestoon.sh', 'installer-raccourci.sh', 'README_ENSEIGNANTE.txt')
$files = [System.Collections.Generic.Dictionary[string, System.IO.FileInfo]]::new([System.StringComparer]::Ordinal)
$excludedCount = 0

function Add-PackageDirectory {
    param([string]$RelativeDirectory)

    foreach ($item in Get-ChildItem -LiteralPath (Join-Path $sourceDir $RelativeDirectory) -Force) {
        $relativePath = "$RelativeDirectory/$($item.Name)"
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Lien symbolique non pris en charge : $relativePath"
        }
        if ($item.Name -match '^(\.|__MACOSX$|__obsolete_|Thumbs\.db$|Desktop\.ini$|node_modules$|tmp$|temp$)' -or
            $item.Name -match '(~$|\.(tmp|temp|bak|log|swp|swo|part|crdownload)$)') {
            $script:excludedCount++
            continue
        }
        if ($item.PSIsContainer) {
            Add-PackageDirectory $relativePath
            continue
        }

        $extension = $item.Extension.ToLowerInvariant()
        $allowed = if ($RelativeDirectory -eq 'src' -or $RelativeDirectory.StartsWith('src/')) {
            $extension -in @('.js', '.css')
        } else {
            $relativePath -cin @('assets/videos/videos.json', 'assets/audio/rewards/sounds.json') -or
            $extension -in @('.mp4', '.mp3', '.wav', '.ogg', '.webm', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp', '.gif', '.woff', '.woff2', '.ttf', '.otf')
        }
        if ($allowed) {
            $files.Add($relativePath, $item)
        } else {
            $script:excludedCount++
        }
    }
}

function Test-MediaManifest {
    param([string]$Directory, [string]$ManifestName, [string]$Extension)

    $manifestPath = "$Directory/$ManifestName"
    if (-not $files.ContainsKey($manifestPath)) {
        throw "Manifest absent : $manifestPath"
    }
    $raw = [System.IO.File]::ReadAllText($files[$manifestPath].FullName)
    if (-not $raw.TrimStart().StartsWith('[')) {
        throw "Le manifest doit contenir un tableau : $manifestPath"
    }
    $entries = @($raw | ConvertFrom-Json)
    $listed = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    foreach ($entry in $entries) {
        $name = $entry.file
        if ($name -isnot [string] -or -not $name -or $name.Contains('\') -or
            $name.StartsWith('/') -or ($name.Split('/') | Where-Object { $_ -in @('', '.', '..') }) -or
            -not $name.EndsWith($Extension, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Chemin de media invalide dans $manifestPath"
        }
        $relativePath = "$Directory/$name"
        if (-not $files.ContainsKey($relativePath)) {
            throw "Media absent, exclu ou casse incorrecte : $relativePath"
        }
        if (-not $listed.Add($relativePath)) {
            throw "Media en double : $relativePath"
        }
    }
    $onDisk = @($files.Keys | Where-Object { $_.StartsWith("$Directory/") -and $_.EndsWith($Extension, [System.StringComparison]::OrdinalIgnoreCase) })
    if ($listed.Count -ne $onDisk.Count) {
        throw "Certains medias ne sont pas declares dans $manifestPath. Regenerer le manifest avant le packaging."
    }
    return $listed.Count
}

foreach ($name in $requiredFiles) {
    $item = Get-Item -LiteralPath (Join-Path $sourceDir $name)
    if ($item.PSIsContainer -or ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Fichier essentiel invalide : $name"
    }
    $files.Add($name, $item)
}
foreach ($directory in @('src', 'assets')) {
    $item = Get-Item -LiteralPath (Join-Path $sourceDir $directory)
    if (-not $item.PSIsContainer -or ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Dossier essentiel invalide : $directory"
    }
    Add-PackageDirectory $directory
}

$stream = [System.IO.File]::OpenRead($files['server'].FullName)
try {
    $header = New-Object byte[] 20
    $read = $stream.Read($header, 0, $header.Length)
    if ($read -lt 20 -or $header[0] -ne 127 -or $header[1] -ne 69 -or $header[2] -ne 76 -or $header[3] -ne 70 -or
        $header[4] -ne 2 -or $header[5] -ne 1 -or $header[18] -ne 62 -or $header[19] -ne 0) {
        throw 'server doit etre un binaire ELF 64 bits x86-64, pas un executable Windows.'
    }
} finally {
    $stream.Dispose()
}
foreach ($name in @('lancer-syllabestoon.sh', 'installer-raccourci.sh')) {
    $content = [System.IO.File]::ReadAllText($files[$name].FullName)
    if (-not $content.StartsWith('#!/usr/bin/env bash') -or $content.Contains("`r")) {
        throw "Script Bash invalide ou fins de ligne non Linux : $name"
    }
}

$videoCount = Test-MediaManifest 'assets/videos' 'videos.json' '.mp4'
$soundCount = Test-MediaManifest 'assets/audio/rewards' 'sounds.json' '.mp3'
Write-Output "Serveur ELF x86-64 OK ; videos : $videoCount ; sons : $soundCount"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$temporaryZip = Join-Path $projectDir ('.SyllabesToon-Linux-' + [guid]::NewGuid().ToString('N') + '.tmp')
try {
    $zipStream = [System.IO.File]::Open($temporaryZip, [System.IO.FileMode]::CreateNew)
    try {
        $archive = [System.IO.Compression.ZipArchive]::new($zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $true, [System.Text.Encoding]::UTF8)
        try {
            foreach ($relativePath in ($files.Keys | Sort-Object)) {
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $files[$relativePath].FullName, "$archiveRoot$relativePath", [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
            }
        } finally {
            $archive.Dispose()
        }
    } finally {
        $zipStream.Dispose()
    }

    $check = [System.IO.Compression.ZipFile]::OpenRead($temporaryZip)
    try {
        if ($check.Entries.Count -ne $files.Count) {
            throw 'Le contenu du ZIP est incomplet.'
        }
        foreach ($entry in $check.Entries) {
            $relativePath = $entry.FullName.Substring($archiveRoot.Length)
            if (-not $entry.FullName.StartsWith($archiveRoot) -or -not $files.ContainsKey($relativePath) -or
                $entry.Length -ne $files[$relativePath].Length) {
                throw "Entree ZIP invalide : $($entry.FullName)"
            }
        }
    } finally {
        $check.Dispose()
    }
    Move-Item -LiteralPath $temporaryZip -Destination $zipPath -Force
} finally {
    if (Test-Path -LiteralPath $temporaryZip) {
        Remove-Item -LiteralPath $temporaryZip -Force
    }
}

$result = Get-Item -LiteralPath $zipPath
Write-Output "ZIP cree : $zipPath"
Write-Output "Fichiers inclus : $($files.Count) ; fichiers parasites exclus dans src/assets : $excludedCount"
Write-Output "Taille : $($result.Length) octets"
