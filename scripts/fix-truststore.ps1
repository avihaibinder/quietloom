# Rebuilds android/certs/cacerts-with-norton.jks - the JDK's own CA bundle plus
# whatever root your local TLS-inspecting antivirus or proxy uses to re-sign traffic.
#
# Why this exists: Gradle downloads every dependency over HTTPS. Norton (and Kaspersky,
# ESET, Zscaler, most corporate proxies) intercept those connections and present a
# certificate signed by their own root. Windows trusts that root; the JDK ships a
# separate CA store and does not. The symptom is:
#
#     PKIX path building failed: unable to find valid certification path to requested target
#
# The JetBrains Runtime does not support -Djavax.net.ssl.trustStoreType=WINDOWS-ROOT,
# so we merge the roots into a copy of cacerts instead.
#
# Run this if the JDK is upgraded or the antivirus rotates its CA.
#
# NOTE: keep this file pure ASCII. PowerShell 5.1 reads a BOM-less UTF-8 file as
# CP1252, which turns the second byte of an em dash into a smart quote - and
# PowerShell treats that as a string delimiter, so the script stops parsing.

$ErrorActionPreference = 'Stop'

$Jbr     = 'C:\Program Files\Android\Android Studio\jbr'
$CertDir = Join-Path $PSScriptRoot '..\android\certs'
$Store   = Join-Path $CertDir 'cacerts-with-norton.jks'

New-Item -ItemType Directory -Force -Path $CertDir | Out-Null

$source = Join-Path $Jbr 'lib\security\cacerts'
if (-not (Test-Path $source)) {
    throw "JDK cacerts not found at $source. Is Android Studio installed at the expected path?"
}
Copy-Item $source $Store -Force

# Roots that look like TLS-interception CAs rather than real public ones.
$patterns = @(
    '*Norton*', '*Kaspersky*', '*ESET*', '*Bitdefender*',
    '*Avast*', '*AVG*', '*Zscaler*', '*Fiddler*', '*Charles*'
)

$found = Get-ChildItem Cert:\LocalMachine\Root, Cert:\CurrentUser\Root |
    Where-Object { $subject = $_.Subject; @($patterns | Where-Object { $subject -like $_ }).Count -gt 0 } |
    Sort-Object Thumbprint -Unique

if (-not $found) {
    Write-Host 'No TLS-interception root found in the Windows store.'
    Write-Host 'The plain JDK cacerts should work. You can remove the two'
    Write-Host 'systemProp.javax.net.ssl.trustStore* lines from android/gradle.properties.'
    exit 0
}

foreach ($cert in $found) {
    $cer = Join-Path $CertDir "$($cert.Thumbprint).cer"
    [IO.File]::WriteAllBytes($cer, $cert.RawData)

    # keytool writes "Certificate was added to keystore" to stderr even when it
    # succeeds. Under $ErrorActionPreference = 'Stop' PowerShell 5.1 turns that into
    # a terminating NativeCommandError, so the only reliable success signal is the
    # exit code. Do not add a 2>&1 redirect here - that is what causes the problem.
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & "$Jbr\bin\keytool.exe" -importcert -noprompt -trustcacerts `
        -alias "local-tls-shield-$($cert.Thumbprint)" `
        -file $cer -keystore $Store -storepass changeit | Out-Null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev

    if ($code -ne 0) { throw "keytool failed importing $($cert.Subject) (exit $code)" }
    Write-Host "Imported: $($cert.Subject)"
}

Write-Host ''
Write-Host "Truststore ready: $Store"
Write-Host 'android/gradle.properties already points at it.'
