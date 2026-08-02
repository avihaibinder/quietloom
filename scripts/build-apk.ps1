# Quietloom - one command from source to a running app on the emulator.
#
#   npm run android
#   .\scripts\build-apk.ps1
#   .\scripts\build-apk.ps1 -SkipEmulator      # build + install on whatever is attached
#   .\scripts\build-apk.ps1 -NoInstall         # build the APK only
#   .\scripts\build-apk.ps1 -Clean             # gradlew clean first
#
# Steps: env -> vite build -> cap sync -> gradlew assembleDebug -> device -> install -> launch.
# Idempotent and safe to re-run.
#
# WHY JAVA_HOME IS FORCED: Capacitor 7 / AGP 8.7 need JDK 21. This machine's default
# `java` on PATH is 17 and the build fails with an "Unsupported class file major version"
# or a Kotlin/JVM target error. Android Studio's bundled JBR 21 is the known-good JDK.
#
# If Gradle dies with "PKIX path building failed" or an SSL handshake error, the
# truststore in android/gradle.properties is missing or stale - run scripts\fix-truststore.ps1.

[CmdletBinding()]
param(
    [switch] $SkipEmulator,   # do not start an emulator; use whatever is attached
    [switch] $NoInstall,      # build only, never touch a device
    [switch] $Clean,          # gradlew clean before assembling
    [string] $Avd = 'Pixel_9a',
    [int]    $BootTimeoutSec = 300
)

# NOT 'Stop'. Windows PowerShell 5.1 turns any line a native .exe writes to stderr
# into an ErrorRecord, and with -ErrorActionPreference Stop that aborts the script
# even when the tool exited 0. npm, gradlew, adb and java all write to stderr
# routinely. Every native call below is checked explicitly via $LASTEXITCODE
# instead, which is the only reliable signal.
$ErrorActionPreference = 'Continue'
$startedAt = Get-Date

$AppId        = 'com.quietloom.app'
$LaunchTarget = "$AppId/.MainActivity"
$ProjectRoot  = Split-Path -Parent $PSScriptRoot
$AndroidDir   = Join-Path $ProjectRoot 'android'
$ApkPath      = Join-Path $AndroidDir 'app\build\outputs\apk\debug\app-debug.apk'

function Write-Step { param([string] $m) Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Ok   { param([string] $m) Write-Host "    $m" -ForegroundColor Green }
function Fail       { param([string] $m) Write-Host "`nFAILED: $m" -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------- environment

Write-Step 'Environment'

$Jbr = 'C:\Program Files\Android\Android Studio\jbr'
if (-not (Test-Path $Jbr)) {
    Fail "JDK 21 not found at $Jbr. Install Android Studio, or point `$Jbr at another JDK 21."
}
$env:JAVA_HOME = $Jbr

if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

$adb      = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
$emulator = Join-Path $env:ANDROID_HOME 'emulator\emulator.exe'
if (-not (Test-Path $adb)) { Fail "adb not found at $adb. Set ANDROID_HOME or install platform-tools." }

# JAVA_HOME\bin first so gradlew and npx both see JDK 21.
$env:PATH = "$Jbr\bin;$(Join-Path $env:ANDROID_HOME 'platform-tools');$(Join-Path $env:ANDROID_HOME 'emulator');$env:PATH"

# Read the version from the JDK's release file rather than `java -version`,
# which prints to stderr and trips PowerShell's native-error handling.
$javaVersion = 'unknown'
$releaseFile = Join-Path $Jbr 'release'
if (Test-Path $releaseFile) {
    $m = Select-String -Path $releaseFile -Pattern '^JAVA_VERSION="?([^"]+)"?' | Select-Object -First 1
    if ($m) { $javaVersion = $m.Matches[0].Groups[1].Value }
}
if ($javaVersion -notlike '21*' -and $javaVersion -ne 'unknown') {
    Write-Host "    WARNING: JDK is $javaVersion, Capacitor 7 expects 21." -ForegroundColor Yellow
}
Write-Ok "JAVA_HOME    $env:JAVA_HOME"
Write-Ok "java         $javaVersion"
Write-Ok "ANDROID_HOME $env:ANDROID_HOME"

# ------------------------------------------------------------------ web build

Write-Step 'Building web assets (vite)'
Push-Location $ProjectRoot
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { Fail 'npm run build failed - fix the JS/CSS errors above.' }
    Write-Ok 'dist/ written'

    Write-Step 'Syncing to the Android project (cap sync)'
    & npx cap sync android
    if ($LASTEXITCODE -ne 0) { Fail 'npx cap sync android failed.' }
    Write-Ok 'web assets + plugins synced'
} finally {
    Pop-Location
}

# `cap sync` must never clobber the AdMob application-ID meta-data: without it the
# app dies at launch with "The Google Mobile Ads SDK was initialized incorrectly".
$manifest = Join-Path $AndroidDir 'app\src\main\AndroidManifest.xml'
if (-not (Select-String -Path $manifest -SimpleMatch 'com.google.android.gms.ads.APPLICATION_ID' -Quiet)) {
    Fail "AndroidManifest.xml has lost the AdMob APPLICATION_ID meta-data. The app will crash at launch - restore it before continuing."
}
Write-Ok 'AdMob APPLICATION_ID meta-data present'

# --------------------------------------------------------------- gradle build

Push-Location $AndroidDir
try {
    if ($Clean) {
        Write-Step 'gradlew clean'
        & .\gradlew.bat clean --console=plain
        if ($LASTEXITCODE -ne 0) { Fail 'gradlew clean failed.' }
    }

    Write-Step 'gradlew assembleDebug'
    & .\gradlew.bat assembleDebug --console=plain
    if ($LASTEXITCODE -ne 0) {
        Fail 'Gradle build failed. If you see "PKIX path building failed" or an SSL handshake error, run scripts\fix-truststore.ps1.'
    }
} finally {
    Pop-Location
}

if (-not (Test-Path $ApkPath)) { Fail "Gradle reported success but no APK at $ApkPath" }
$apkSizeMb = [math]::Round((Get-Item $ApkPath).Length / 1MB, 2)
Write-Ok "APK built: $ApkPath ($apkSizeMb MB)"

if ($NoInstall) {
    $elapsed = [int]((Get-Date) - $startedAt).TotalSeconds
    Write-Host "`nSUCCESS (build only, ${elapsed}s)" -ForegroundColor Green
    Write-Host "APK: $ApkPath"
    exit 0
}

# -------------------------------------------------------------------- device

Write-Step 'Finding a device'

function Get-OnlineDevice {
    $lines = & $adb devices
    foreach ($line in $lines) {
        if ($line -match '^(\S+)\s+device$') { return $Matches[1] }
    }
    return $null
}

$serial = Get-OnlineDevice

if (-not $serial) {
    if ($SkipEmulator) {
        Fail 'No device attached and -SkipEmulator was set. Plug in a phone or drop -SkipEmulator.'
    }
    Write-Ok "No device attached - booting '$Avd'"
    & (Join-Path $PSScriptRoot 'run-emulator.ps1') -Avd $Avd -TimeoutSec $BootTimeoutSec
    if ($LASTEXITCODE -ne 0) { Fail "Could not boot the emulator '$Avd'." }
    $serial = Get-OnlineDevice
    if (-not $serial) { Fail 'Emulator reported booted but adb still sees no device.' }
}

& $adb -s $serial wait-for-device
Write-Ok "device: $serial"

# A device can be `device` in adb before the framework is up; installing then fails.
$booted = ("$(& $adb -s $serial shell getprop sys.boot_completed)").Trim()
if ($booted -ne '1') {
    Write-Ok 'Framework still starting, waiting...'
    & (Join-Path $PSScriptRoot 'run-emulator.ps1') -Avd $Avd -TimeoutSec $BootTimeoutSec
}

# ------------------------------------------------------------------- install

Write-Step 'Installing'
& $adb -s $serial install -r "$ApkPath"
if ($LASTEXITCODE -ne 0) {
    # Almost always a signing-key mismatch from a previously installed build.
    Write-Ok 'Install failed - uninstalling the old copy and retrying'
    & $adb -s $serial uninstall $AppId | Out-Null
    & $adb -s $serial install "$ApkPath"
    if ($LASTEXITCODE -ne 0) { Fail "adb install failed on $serial." }
}
Write-Ok "installed $AppId"

# -------------------------------------------------------------------- launch

Write-Step 'Launching'
& $adb -s $serial shell am force-stop $AppId
& $adb -s $serial shell am start -n $LaunchTarget
if ($LASTEXITCODE -ne 0) { Fail "Could not launch $LaunchTarget." }

$elapsed = [int]((Get-Date) - $startedAt).TotalSeconds
Write-Host "`nSUCCESS in ${elapsed}s" -ForegroundColor Green
Write-Host "APK:    $ApkPath"
Write-Host "Device: $serial"
Write-Host "Running $LaunchTarget"
Write-Host ''
Write-Host 'Logs:      adb logcat -s Capacitor:V Ads:V chromium:V' -ForegroundColor DarkGray
Write-Host 'AdMob:     adb logcat | Select-String -Pattern "Ads|AdMob"' -ForegroundColor DarkGray
Write-Host 'Web debug: chrome://inspect  (webContentsDebuggingEnabled is on for debug builds)' -ForegroundColor DarkGray
