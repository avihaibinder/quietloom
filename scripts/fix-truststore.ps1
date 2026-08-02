# Rebuilds android/certs/cacerts-with-norton.jks — the JDK's own CA bundle plus whatever
# root your local TLS-inspecting antivirus/proxy uses to re-sign traffic.
#
# Why this exists: Gradle downloads every dependency over HTTPS. Norton (and Kaspersky,
# ESET, Zscaler, most corporate proxies) man-in-the-middles those connections and presents
# a certificate signed by its own root. Windows trusts that root; the JDK ships its own
# separate CA store and does not. The symptom is:
#     PKIX path building failed: unable to find valid certification path to requested target
#
# JBR does not support -Djavax.net.ssl.trustStoreType=WINDOWS-ROOT, so we merge instead.
# Run this if the JDK is upgraded or the AV rotates its CA.

$ErrorActionPreference = 'Stop'

$Jbr     = 'C:\Program Files\Android\Android Studio\jbr'
$CertDir = Join-Path $PSScriptRoot '..\android\certs'
$Store   = Join-Path $CertDir 'cacerts-with-norton.jks'

New-Item -ItemType Directory -Force -Path $CertDir | Out-Null

$source = Join-Path $Jbr 'lib\security\cacerts'
if (-not (Test-Path $source)) { throw "JDK cacerts not found at $source — is JAVA_HOME right?" }
Copy-Item $source $Store -Force

# Any root that looks like a TLS-interception CA rather than a real public one.
$patterns = @('*Norton*', '*Kaspersky*', '*ESET*', '*Bitdefender*', '*Avast*', '*AVG*', '*Zscaler*', '*Fiddler*')
$found = Get-ChildItem Cert:\LocalMachine\Root, Cert:\CurrentUser\Root |
    Where-Object { $s = $_.Subject; $patterns | Where-Object { $s -like $_ } } |
    Sort-Object Thumbprint -Unique

if (-not $found) {
    Write-Host 'No TLS-interception root found. The plain JDK cacerts should work — you can remove the trustStore lines from gradle.properties.'
    exit 0
}

foreach ($cert in $found) {
    $cer = Join-Path $CertDir "$($cert.Thumbprint).cer"
    [IO.File]::WriteAllBytes($cer, $cert.RawData)
    & "$Jbr\bin\keytool.exe" -importcert -noprompt -trustcacerts `
        -alias "local-tls-shield-$($cert.Thumbprint)" -file $cer -keystore $Store -storepass changeit
    Write-Host "Imported: $($cert.Subject)"
}

Write-Host ''
Write-Host "Truststore ready: $Store"
Write-Host 'android/gradle.properties already points at it via systemProp.javax.net.ssl.trustStore.'
