[CmdletBinding(SupportsShouldProcess = $true)]
param([string]$TyporaDirectory = 'C:\Program Files\Typora')
$ErrorActionPreference = 'Stop'
$appRoot = (Resolve-Path -LiteralPath $TyporaDirectory).Path
$resources = Join-Path $appRoot 'resources'
$windowFile = Join-Path $resources 'window.html'
$pluginTarget = [IO.Path]::GetFullPath((Join-Path $resources 'typora-side-comments'))
$allowedTarget = [IO.Path]::GetFullPath($resources) + [IO.Path]::DirectorySeparatorChar + 'typora-side-comments'
if ($pluginTarget -ne $allowedTarget) { throw 'Refusing to remove an unexpected path.' }
if (!(Test-Path -LiteralPath (Join-Path $appRoot 'Typora.exe')) -or !(Test-Path -LiteralPath $windowFile)) { throw 'Invalid Typora installation.' }
foreach ($part in @($appRoot,$resources,$windowFile,$pluginTarget)) {
    if ((Test-Path -LiteralPath $part) -and ((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Reparse point detected: $part" }
}
if (Test-Path -LiteralPath $pluginTarget) {
    if (!(Test-Path -LiteralPath (Join-Path $pluginTarget '.typora-side-comments-owned'))) { throw 'Target folder is not owned by this plugin.' }
    if (Get-ChildItem -LiteralPath $pluginTarget -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Plugin folder contains a reparse point.' }
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
$original = [IO.File]::ReadAllText($windowFile, $utf8)
$hasStart = $original.Contains('<!-- typora-side-comments:start -->')
$hasEnd = $original.Contains('<!-- typora-side-comments:end -->')
if ($hasStart -ne $hasEnd) { throw 'Incomplete plugin marker. No files were changed.' }
$updated = [regex]::Replace($original, '(?s)<!-- typora-side-comments:start -->.*?<!-- typora-side-comments:end -->\r?\n?', '')
if (!$PSCmdlet.ShouldProcess($appRoot, 'Remove Typora Side Comments; keep every document and annotation file')) { return }
if (Get-Process -Name Typora -ErrorAction SilentlyContinue) { throw 'Save documents and close all Typora windows first.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$windowBackup = "$windowFile.before-side-comments-uninstall-$stamp.bak"
Copy-Item -LiteralPath $windowFile -Destination $windowBackup
$temporary = "$windowFile.side-comments-uninstall-$stamp.tmp"
try { [IO.File]::WriteAllText($temporary, $updated, $utf8); [IO.File]::Replace($temporary, $windowFile, $windowBackup) }
finally { if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force } }
# Exact, fixed plugin folder checked above; never remove .comments.json documents or backups.
if (Test-Path -LiteralPath $pluginTarget) { Remove-Item -LiteralPath $pluginTarget -Recurse -Force }
Write-Output 'Uninstalled. Markdown files, annotation sidecars, and backups were retained.'
