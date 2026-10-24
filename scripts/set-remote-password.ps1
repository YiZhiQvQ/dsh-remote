$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$user = Read-Host 'Username [admin]'
if ([string]::IsNullOrWhiteSpace($user)) {
  $user = 'admin'
}
$secure = Read-Host 'Password' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if ([string]::IsNullOrEmpty($plain)) {
  throw 'Password must not be empty.'
}
$plain | & node (Join-Path $root 'scripts\set-remote-password.mjs') $user
if ($LASTEXITCODE -ne 0) {
  throw 'Failed to save the remote password.'
}
