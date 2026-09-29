$ErrorActionPreference = 'Stop'
$package = Split-Path -Parent $PSScriptRoot
$tempRoot = [IO.Path]::GetFullPath((Join-Path $package ('installer-fixture-' + [guid]::NewGuid().ToString('N'))))
if (!$tempRoot.StartsWith([IO.Path]::GetFullPath($package) + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid test directory.' }
New-Item -ItemType Directory -Path (Join-Path $tempRoot 'resources') | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
$window = Join-Path $tempRoot 'resources\window.html'
$initial = '<html><body><script defer src="./appsrc/window/frame.js"></script><p>USER CONTENT</p></body></html>'
[IO.File]::WriteAllText($window, $initial, $utf8)
[IO.File]::WriteAllText((Join-Path $tempRoot 'Typora.exe'), 'isolated installer fixture', $utf8)
# Deliberately mock process lookup only in this test; no real application is closed or changed.
function Get-Process { [CmdletBinding()] param([string]$Name) }
$copyFault = @{ Enabled = $false }
function Copy-Item {
    [CmdletBinding()] param([string]$LiteralPath,[string]$Destination,[switch]$Recurse,[switch]$Force)
    if ($copyFault.Enabled -and $LiteralPath -eq (Join-Path $package 'plugin\ui.js')) { throw 'Simulated copy failure for rollback testing.' }
    Microsoft.PowerShell.Management\Copy-Item @PSBoundParameters
}
$script:checks = 0
function Check($ok, $message) { if (!$ok) { throw "FAIL $message" }; $script:checks++; Write-Output "PASS $message" }
try {
    & (Join-Path $package 'Install.ps1') -TyporaDirectory $tempRoot -WhatIf
    Check (([IO.File]::ReadAllText($window)) -eq $initial) 'WhatIf leaves window intact'
    & (Join-Path $package 'Install.ps1') -TyporaDirectory $tempRoot -Confirm:$false
    $installed = [IO.File]::ReadAllText($window)
    Check ($installed.Contains('typora-side-comments/boot.js')) 'loader injected'
    Check ((Get-ChildItem -LiteralPath (Join-Path $tempRoot 'resources\typora-side-comments') -File -Force).Count -eq 7) 'six files and ownership marker installed'
    Check ((Get-ChildItem -LiteralPath (Join-Path $tempRoot 'resources') -Filter '*.bak').Count -gt 0) 'window backup created'
    Start-Sleep -Milliseconds 20
    & (Join-Path $package 'Install.ps1') -TyporaDirectory $tempRoot -Confirm:$false
    $reinstalled = [IO.File]::ReadAllText($window)
    Check (([regex]::Matches($reinstalled, 'typora-side-comments/boot.js')).Count -eq 1) 'reinstall is idempotent'
    [IO.File]::WriteAllText($window, $reinstalled.Replace('USER CONTENT', 'USER EDIT AFTER INSTALL'), $utf8)
    & (Join-Path $package 'Uninstall.ps1') -TyporaDirectory $tempRoot -Confirm:$false
    $removed = [IO.File]::ReadAllText($window)
    Check (!$removed.Contains('typora-side-comments/boot.js')) 'loader removed'
    Check ($removed.Contains('USER EDIT AFTER INSTALL')) 'unrelated edits preserved during uninstall'
    Check (!(Test-Path -LiteralPath (Join-Path $tempRoot 'resources\typora-side-comments'))) 'owned plugin directory removed'
    $copyFault.Enabled = $true
    $failure = ''
    try { & (Join-Path $package 'Install.ps1') -TyporaDirectory $tempRoot -Confirm:$false } catch { $failure = $_.Exception.Message }
    $copyFault.Enabled = $false
    Check ($failure.Contains('Simulated copy failure')) 'first-install failure injected'
    Check (([IO.File]::ReadAllText($window)) -eq $removed) 'first-install rollback preserves window'
    Check (!(Test-Path -LiteralPath (Join-Path $tempRoot 'resources\typora-side-comments'))) 'partial first-install directory removed'
    & (Join-Path $package 'Install.ps1') -TyporaDirectory $tempRoot -Confirm:$false
    $previousWindow = [IO.File]::ReadAllText($window)
    $target = Join-Path $tempRoot 'resources\typora-side-comments'
    [IO.File]::WriteAllText((Join-Path $target 'custom.txt'), 'prior user file', $utf8)
    [IO.File]::WriteAllText((Join-Path $target 'boot.js'), 'prior plugin version', $utf8)
    $copyFault.Enabled = $true
    $failure = ''
    try { & (Join-Path $package 'Install.ps1') -TyporaDirectory $tempRoot -Confirm:$false } catch { $failure = $_.Exception.Message }
    $copyFault.Enabled = $false
    Check ($failure.Contains('Simulated copy failure')) 'upgrade failure injected'
    Check (([IO.File]::ReadAllText($window)) -eq $previousWindow) 'upgrade rollback preserves window'
    Check (([IO.File]::ReadAllText((Join-Path $target 'boot.js'))) -eq 'prior plugin version') 'upgrade restores previous plugin files'
    Check (([IO.File]::ReadAllText((Join-Path $target 'custom.txt'))) -eq 'prior user file') 'upgrade restores additional existing files'
    Write-Output "INSTALLER CHECKS: $script:checks passed"
} finally {
    $resolved = (Resolve-Path -LiteralPath $tempRoot).Path
    if (!$resolved.StartsWith([IO.Path]::GetFullPath($package) + [IO.Path]::DirectorySeparatorChar)) { throw 'Cleanup boundary mismatch.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
