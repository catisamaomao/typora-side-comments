[CmdletBinding(SupportsShouldProcess = $true)]
param([string]$TyporaDirectory = 'C:\Program Files\Typora')
$ErrorActionPreference = 'Stop'
$appRoot = (Resolve-Path -LiteralPath $TyporaDirectory).Path
$resources = Join-Path $appRoot 'resources'
$windowFile = Join-Path $resources 'window.html'
$pluginTarget = Join-Path $resources 'typora-side-comments'
$pluginSource = Join-Path $PSScriptRoot 'plugin'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$markerStart = '<!-- typora-side-comments:start -->'
$markerEnd = '<!-- typora-side-comments:end -->'
if (!(Test-Path -LiteralPath (Join-Path $appRoot 'Typora.exe')) -or !(Test-Path -LiteralPath $windowFile)) { throw 'This folder is not a supported Typora installation.' }
foreach ($part in @($appRoot, $resources, $windowFile, $pluginTarget)) {
    if ((Test-Path -LiteralPath $part) -and ((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Reparse points are not supported: $part" }
}
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'SHA256.json') -Raw | ConvertFrom-Json
foreach ($entry in $manifest.PSObject.Properties) {
    $candidate = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot $entry.Name))
    if (!$candidate.StartsWith([IO.Path]::GetFullPath($PSScriptRoot) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid package path.' }
    if ((Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash -ne $entry.Value) { throw "Package integrity check failed: $($entry.Name)" }
}
$original = [IO.File]::ReadAllText($windowFile, $utf8)
if (!$original.Contains('./appsrc/window/frame.js')) { throw 'Unsupported Typora window layout. No files were changed.' }
$hasStart = $original.Contains($markerStart)
$hasEnd = $original.Contains($markerEnd)
if ($hasStart -ne $hasEnd) { throw 'Incomplete existing plugin marker. Inspect window.html before proceeding.' }
if ((Test-Path -LiteralPath $pluginTarget) -and !(Test-Path -LiteralPath (Join-Path $pluginTarget '.typora-side-comments-owned'))) { throw 'Target folder already exists and is not owned by this package.' }
if (Test-Path -LiteralPath $pluginTarget) {
    if (Get-ChildItem -LiteralPath $pluginTarget -Force -Recurse | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Plugin folder contains a reparse point.' }
}
$block = "$markerStart`r`n<script defer src=`"./typora-side-comments/boot.js`"></script>`r`n$markerEnd"
$updated = if ($hasStart) { [regex]::Replace($original, '(?s)<!-- typora-side-comments:start -->.*?<!-- typora-side-comments:end -->', $block) } else { $original.Replace('</body>', "$block`r`n</body>") }
if ($updated -eq $original -and !$hasStart) { throw 'Could not locate the insertion point.' }
Write-Output "Typora: $appRoot"
Write-Output 'Changes: install six plugin files; add one script block; back up window.html.'
Write-Output 'Document files, licenses, user settings, and folder permissions are not modified.'
if (!$PSCmdlet.ShouldProcess($appRoot, 'Install Typora Side Comments')) { return }
if (Get-Process -Name Typora -ErrorAction SilentlyContinue) { throw 'Please save your documents and close all Typora windows, then run the installer again.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$windowBackup = "$windowFile.side-comments-$stamp.bak"
$oldPluginBackup = "$pluginTarget.backup-$stamp"
$windowTemporary = "$windowFile.side-comments-$stamp.tmp"
Copy-Item -LiteralPath $windowFile -Destination $windowBackup
$hadPlugin = Test-Path -LiteralPath $pluginTarget
if ($hadPlugin) { Copy-Item -LiteralPath $pluginTarget -Destination $oldPluginBackup -Recurse }
try {
    New-Item -ItemType Directory -Path $pluginTarget -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $pluginTarget '.typora-side-comments-owned'), '1.1.0', $utf8)
    foreach ($name in @('boot.js','i18n.js','core.js','storage.cjs','ui.js','style.css')) { Copy-Item -LiteralPath (Join-Path $pluginSource $name) -Destination (Join-Path $pluginTarget $name) -Force }
    [IO.File]::WriteAllText($windowTemporary, $updated, $utf8)
    [IO.File]::Replace($windowTemporary, $windowFile, $windowBackup)
    foreach ($name in @('boot.js','i18n.js','core.js','storage.cjs','ui.js','style.css')) {
        if ((Get-FileHash -LiteralPath (Join-Path $pluginSource $name)).Hash -ne (Get-FileHash -LiteralPath (Join-Path $pluginTarget $name)).Hash) { throw "Installed file verification failed: $name" }
    }
    Write-Output "Installed. Backup: $windowBackup"
    Write-Output 'Open Typora, choose a sidebar language, select text, and click Add comment.'
} catch {
    $installError = $_
    Copy-Item -LiteralPath $windowBackup -Destination $windowFile -Force
    if (Test-Path -LiteralPath $pluginTarget) {
        $resolvedPlugin = (Resolve-Path -LiteralPath $pluginTarget).Path
        $expectedPlugin = [IO.Path]::GetFullPath($resources) + [IO.Path]::DirectorySeparatorChar + 'typora-side-comments'
        if ($resolvedPlugin -ne $expectedPlugin) { throw 'Rollback path verification failed; inspect the saved backup.' }
        if (((Get-Item -LiteralPath $resolvedPlugin -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -or (Get-ChildItem -LiteralPath $resolvedPlugin -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })) { throw 'Rollback refused a reparse point; inspect the saved backup.' }
        Remove-Item -LiteralPath $resolvedPlugin -Recurse -Force
    }
    if ($hadPlugin) { Copy-Item -LiteralPath $oldPluginBackup -Destination $pluginTarget -Recurse -Force }
    throw $installError
} finally {
    if (Test-Path -LiteralPath $windowTemporary) { Remove-Item -LiteralPath $windowTemporary -Force }
}
