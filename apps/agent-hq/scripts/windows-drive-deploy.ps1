#requires -Version 7.0
<#
Read-only by default. -Deploy additionally requires typing the exact project ID.
Never paste a token into the command line: the script prompts with masked input.
This installs only drive-api. It does not run SQL, change secrets, enable the
frontend, merge main, or initiate Google consent/file operations.
#>
[CmdletBinding()]
param(
  [switch]$Deploy,
  [System.Security.SecureString]$AccessToken
)

$script:DriveProject = 'vhywnalpkahkfqhiqdgd'
$script:DriveApiBase = "https://api.supabase.com/v1/projects/$script:DriveProject"
$script:DriveSourceCommit = '34d21382d89f61e1a5811329f6cad9db16f3a2ad'
$script:DriveSourceBase = "https://raw.githubusercontent.com/phetsamoneken-spec/beerlao/$script:DriveSourceCommit/apps/agent-hq/supabase/functions"
$script:DriveFiles = [ordered]@{
  'drive-api/index.ts' = 'cf2a02e0bedd1483d8979844e8711a6fbeb40e8cbca86d1bfc3cbc58f50a07c6'
  '_shared/drive.ts' = 'c50faad07e3957d0cd2b84bceb4844d1141991567b51f7200177ca6a8574d87a'
  '_shared/drive-contracts.ts' = '0d6a47864e1c79f6b021ee58458468fef4ead5fca16ccf0fab29a553444092f9'
  '_shared/contracts.ts' = 'ffd311c9326fa8d49c33ab76ac1eb03e50d2f9903a7738845c40bf19cc832705'
  'deno.json' = 'a20f35987e5301e4636767caf5a262ae3abf940c30d1821b604587f2871c94e5'
}

function Invoke-DriveMetadata {
  param([ValidateSet('functions','secrets')][string]$Resource, [hashtable]$Headers)
  try {
    Invoke-RestMethod -Method Get -Uri "$script:DriveApiBase/$Resource" -Headers $Headers -MaximumRedirection 0 -TimeoutSec 30 -ErrorAction Stop
  } catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'network error' }
    throw "Cannot read $Resource (HTTP $status). No deployment was performed."
  }
}

function Get-DriveSources {
  param([string]$Directory)
  foreach ($name in $script:DriveFiles.Keys) {
    $file = Join-Path $Directory $name
    $null = New-Item -ItemType Directory -Force -Path (Split-Path $file)
    Invoke-WebRequest -Uri "$script:DriveSourceBase/$name" -OutFile $file -MaximumRedirection 0 -TimeoutSec 60 -ErrorAction Stop
    $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -cne $script:DriveFiles[$name]) { throw "Source checksum mismatch: $name. Refusing deployment." }
  }
}

function New-DriveUpload {
  param([string]$Directory)
  $form = [System.Net.Http.MultipartFormDataContent]::new()
  try {
    $metadata = @{ name='drive-api'; entrypoint_path='drive-api/index.ts'; import_map_path='deno.json'; verify_jwt=$false } | ConvertTo-Json -Compress
    $part = [System.Net.Http.StringContent]::new($metadata, [System.Text.Encoding]::UTF8, 'application/json')
    $form.Add($part, 'metadata')
    foreach ($name in $script:DriveFiles.Keys) {
      $file = Join-Path $Directory $name
      $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($actual -cne $script:DriveFiles[$name]) { throw "Source checksum mismatch: $name. Refusing deployment." }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $filePart = [System.Net.Http.ByteArrayContent]::new($bytes)
      $filePart.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/octet-stream')
      $form.Add($filePart, 'file', $name)
    }
    return ,$form
  } catch { $form.Dispose(); throw }
}

function Assert-DriveDeploymentResponse {
  param($Result)
  if ($Result.slug -ne 'drive-api' -or $Result.status -ne 'ACTIVE') {
    throw 'Deployment response requires review. Inspect Supabase Functions; do not redeploy blindly.'
  }
  # verify_jwt is optional in the documented response. Live CORS/auth probes
  # below verify behavior even when the API omits that field.
  $jwt = $Result.PSObject.Properties['verify_jwt']
  if ($jwt -and $jwt.Value -ne $false) {
    throw 'Deployment JWT configuration requires review. Do not enable the frontend.'
  }
}

function Invoke-DriveWindowsSetup {
  param([switch]$PublishFunction, [System.Security.SecureString]$Token)
  $ErrorActionPreference = 'Stop'
  $headers = @{}
  $plain = $null
  $sourceDirectory = $null
  try {
    if (-not $Token) { $Token = Read-Host 'Paste NEW Supabase access token, then Enter' -AsSecureString }
    $plain = [PSCredential]::new('token', $Token).GetNetworkCredential().Password.Trim()
    if (-not $plain.StartsWith('sbp_')) { throw 'Use a Supabase account access token starting with sbp_. No deployment was performed.' }
    $headers['Authorization'] = 'Bearer ' + $plain
    $functions = @(Invoke-DriveMetadata -Resource functions -Headers $headers)
    Write-Host 'functions : PASS'
    $secrets = @(Invoke-DriveMetadata -Resource secrets -Headers $headers)
    $names = @($secrets | ForEach-Object { $_.name })
    $required = @('GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI','GOOGLE_TOKEN_ENCRYPTION_KEY','DRIVE_APP_URL','ALLOWED_ORIGINS')
    $missing = @($required | Where-Object { $names -cnotcontains $_ })
    if ($missing.Count) { throw ('Missing hosted secret names: ' + ($missing -join ', ') + '. No deployment was performed.') }
    Write-Host 'secrets : PASS (six required names; values were not retrieved)'
    if (-not $PublishFunction) {
      Write-Host 'CHECK COMPLETE. Nothing was deployed. SQL/frontend are unchanged.'
      return
    }
    if ($functions | Where-Object { $_.slug -eq 'drive-api' }) {
      throw 'drive-api already exists. This script refuses to overwrite it; review the existing function first.'
    }
    Write-Host "Target: $script:DriveProject; create drive-api only; Google callback uses verify_jwt=false."
    Write-Host 'All app POST requests still verify Auth in the function. Install reviewed migration 003 separately first.'
    $confirmation = Read-Host "To approve this live function creation, type DEPLOY $script:DriveProject"
    if ($confirmation -cne "DEPLOY $script:DriveProject") { Write-Host 'Cancelled. Nothing was deployed.'; return }
    $sourceDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ('agent-hq-drive-' + [Guid]::NewGuid().ToString('N'))
    Get-DriveSources -Directory $sourceDirectory
    $form = New-DriveUpload -Directory $sourceDirectory
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromMinutes(3)
    $message = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, "$script:DriveApiBase/functions/deploy?slug=drive-api")
    $message.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $plain)
    $message.Content = $form
    $response = $null
    try {
      $response = $client.SendAsync($message).GetAwaiter().GetResult()
      if (-not $response.IsSuccessStatusCode) { throw "Function upload returned HTTP $([int]$response.StatusCode). Check Supabase Functions before retrying; no automatic retry is performed." }
      $result = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
      Assert-DriveDeploymentResponse -Result $result
      Write-Host "drive-api : DEPLOYED (version $($result.version))"
    } finally {
      if ($response) { $response.Dispose() }
      $message.Dispose()
      $client.Dispose()
    }
    $url = "https://$script:DriveProject.supabase.co/functions/v1/drive-api"
    $preflight = Invoke-WebRequest -Method Options -Uri $url -Headers @{ Origin='https://phetsamoneken-spec.github.io' } -SkipHttpErrorCheck -MaximumRedirection 0 -TimeoutSec 30
    if ($preflight.StatusCode -ne 204 -or $preflight.Headers['Access-Control-Allow-Origin'] -cne 'https://phetsamoneken-spec.github.io') { throw 'Function was created, but CORS verification failed. Inspect deployment before continuing.' }
    $denied = Invoke-WebRequest -Method Post -Uri $url -ContentType 'application/json' -Body '{}' -SkipHttpErrorCheck -MaximumRedirection 0 -TimeoutSec 30
    if ($denied.StatusCode -ne 401 -or ($denied.Content | ConvertFrom-Json).error -ne 'UNAUTHENTICATED') { throw 'Function was created, but unauthenticated-denial verification failed. Do not enable the frontend.' }
    Write-Host 'CORS : PASS; unauthenticated POST : DENIED'
    Write-Host 'Backend boot verified. Real Google consent/read/refresh remain untested; frontend is unchanged.'
  } catch {
    # Do not echo raw HTTP exceptions, request headers, provider bodies or tokens.
    $safe = [string]$_.Exception.Message
    if ($plain) { $safe = $safe.Replace($plain, '[redacted]') }
    Write-Error $safe -ErrorAction Continue
    throw 'Drive setup stopped. No automatic retry was performed.'
  } finally {
    $headers.Clear()
    $plain = $null
    if ($Token) { $Token.Dispose() }
    if ($sourceDirectory -and (Test-Path -LiteralPath $sourceDirectory)) { Remove-Item -LiteralPath $sourceDirectory -Recurse -Force }
  }
}

if ($MyInvocation.InvocationName -ne '.') {
  Invoke-DriveWindowsSetup -PublishFunction:$Deploy -Token $AccessToken
}
