#requires -Version 7.0
# Offline fixtures only. Never use an actual management token in this test.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../../scripts/windows-drive-deploy.ps1')
$script:Calls = @()
$script:Missing = $false
$script:Existing = $false
$script:Prompts = 0
$script:Downloads = 0
$script:LocalSources = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../supabase/functions'))
function Assert-Drive([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Test-DriveToken { ConvertTo-SecureString 'sbp_offline_fixture_not_a_credential' -AsPlainText -Force }
function Invoke-RestMethod {
  param($Method,$Uri,$Headers,$MaximumRedirection,$TimeoutSec,$ErrorAction)
  Assert-Drive ($Method -eq 'Get') 'Default/check path attempted a write.'
  Assert-Drive ($Uri.StartsWith('https://api.supabase.com/v1/projects/vhywnalpkahkfqhiqdgd/')) 'Wrong credential destination.'
  $script:Calls += $Uri
  if ($Uri.EndsWith('/functions')) {
    if ($script:Existing) { return @{slug='drive-api'} }
    return @()
  }
  if ($Uri.EndsWith('/secrets')) {
    $names = @('GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI','GOOGLE_TOKEN_ENCRYPTION_KEY','DRIVE_APP_URL','ALLOWED_ORIGINS')
    if ($script:Missing) { $names = $names | Where-Object { $_ -ne 'GOOGLE_CLIENT_SECRET' } }
    return @($names | ForEach-Object { @{name=$_} })
  }
  throw 'Unexpected metadata URL.'
}
function Read-Host { param($Prompt,[switch]$AsSecureString); $script:Prompts++; return 'CANCEL' }
function Invoke-WebRequest {
  param($Uri,$OutFile,$MaximumRedirection,$TimeoutSec,$ErrorAction)
  $script:Downloads++
  Assert-Drive ($Uri.StartsWith($script:DriveSourceBase + '/')) 'Unexpected source URL.'
  $relative = $Uri.Substring($script:DriveSourceBase.Length + 1)
  Copy-Item -LiteralPath (Join-Path $script:LocalSources $relative) -Destination $OutFile
}
function Expect-DriveFailure([scriptblock]$Action) {
  $failed = $false
  try { & $Action } catch { $failed = $true }
  Assert-Drive $failed 'Expected guarded failure.'
}

Invoke-DriveWindowsSetup -Token (Test-DriveToken)
Assert-Drive ($script:Calls.Count -eq 2 -and $script:Prompts -eq 0 -and $script:Downloads -eq 0) 'Default mode was not read-only.'
$script:Missing = $true
Expect-DriveFailure { Invoke-DriveWindowsSetup -PublishFunction -Token (Test-DriveToken) 2>$null }
Assert-Drive ($script:Prompts -eq 0 -and $script:Downloads -eq 0) 'Missing configuration reached deployment.'
$script:Missing = $false; $script:Existing = $true
Expect-DriveFailure { Invoke-DriveWindowsSetup -PublishFunction -Token (Test-DriveToken) 2>$null }
Assert-Drive ($script:Prompts -eq 0 -and $script:Downloads -eq 0) 'Existing function overwrite was not refused.'
$script:Existing = $false
Invoke-DriveWindowsSetup -PublishFunction -Token (Test-DriveToken)
Assert-Drive ($script:Prompts -eq 1 -and $script:Downloads -eq 0) 'Cancelled approval caused downloads/write.'
$before = $script:Calls.Count
Expect-DriveFailure { Invoke-DriveWindowsSetup -Token (ConvertTo-SecureString 'wrong-type-fixture' -AsPlainText -Force) 2>$null }
Assert-Drive ($script:Calls.Count -eq $before) 'Wrong token type reached network.'

$directory = Join-Path ([System.IO.Path]::GetTempPath()) ('drive-upload-test-' + [Guid]::NewGuid().ToString('N'))
try {
  Get-DriveSources -Directory $directory
  $form = New-DriveUpload -Directory $directory
  try {
    Assert-Drive ($form -is [System.Net.Http.MultipartFormDataContent]) 'Multipart was accidentally enumerated.'
    $parts = @($form.GetEnumerator())
    Assert-Drive ($parts.Count -eq 6) 'Wrong multipart part count.'
    $metadataPart = $parts | Where-Object { $_.Headers.ContentDisposition.Name.Trim('"') -eq 'metadata' }
    $metadata = $metadataPart.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
    Assert-Drive ($metadata.entrypoint_path -eq 'drive-api/index.ts' -and $metadata.import_map_path -eq 'deno.json' -and $metadata.verify_jwt -eq $false) 'Wrong deployment metadata.'
    $filenames = @($parts | Where-Object { $_.Headers.ContentDisposition.Name.Trim('"') -eq 'file' } | ForEach-Object { $_.Headers.ContentDisposition.FileName.Trim('"') })
    foreach ($file in $script:DriveFiles.Keys) { Assert-Drive ($filenames -ccontains $file) 'Relative source filename was lost.' }
  } finally { $form.Dispose() }
  Set-Content -LiteralPath (Join-Path $directory 'drive-api/index.ts') -Value 'tampered fixture' -Encoding utf8
  Expect-DriveFailure { $unexpected = New-DriveUpload -Directory $directory; $unexpected.Dispose() }
} finally { if (Test-Path $directory) { Remove-Item -LiteralPath $directory -Recurse -Force } }
Assert-DriveDeploymentResponse -Result ([pscustomobject]@{slug='drive-api';status='ACTIVE'})
Assert-DriveDeploymentResponse -Result ([pscustomobject]@{slug='drive-api';status='ACTIVE';verify_jwt=$false})
Expect-DriveFailure { Assert-DriveDeploymentResponse -Result ([pscustomobject]@{slug='drive-api';status='ACTIVE';verify_jwt=$true}) }
Expect-DriveFailure { Assert-DriveDeploymentResponse -Result ([pscustomobject]@{slug='other';status='ACTIVE'}) }
Write-Host 'PASS: seven offline guard/multipart/response checks; no real credentials or network writes.'
