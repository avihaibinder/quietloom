# Boots the Pixel_9a emulator and blocks until Android has finished booting.
#
# Pixel_9a is the AVD to use because it ships Google Play services - AdMob will
# not serve even test ads on a plain AOSP image.
#
# Safe to re-run: if a device is already attached and booted this exits at once
# without starting a second emulator.
#
#   .\scripts\run-emulator.ps1
#   .\scripts\run-emulator.ps1 -Avd Pixel_9a_2 -TimeoutSec 420

[CmdletBinding()]
param(
    [string] $Avd = 'Pixel_9a',
    [int]    $TimeoutSec = 300,
    [switch] $NoBootAnim
)

# NOT 'Stop': adb writes routine chatter ("device offline", daemon start-up) to
# stderr, which PowerShell 5.1 would otherwise turn into a terminating error.
# Failures are surfaced with explicit throws below.
$ErrorActionPreference = 'Continue'

if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

$adb      = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
$emulator = Join-Path $env:ANDROID_HOME 'emulator\emulator.exe'

if (-not (Test-Path $adb))      { throw "adb not found at $adb - is ANDROID_HOME correct?" }
if (-not (Test-Path $emulator)) { throw "emulator not found at $emulator" }

# Returns the serial of the first fully-online device, or $null.
function Get-OnlineDevice {
    $lines = & $adb devices
    foreach ($line in $lines) {
        if ($line -match '^(\S+)\s+device$') { return $Matches[1] }
    }
    return $null
}

function Test-BootCompleted {
    param([string] $Serial)
    try {
        $v = (& $adb -s $Serial shell getprop sys.boot_completed)
        return (("$v").Trim() -eq '1')
    } catch {
        return $false
    }
}

# --- already up? ------------------------------------------------------------

$serial = Get-OnlineDevice
if ($serial -and (Test-BootCompleted -Serial $serial)) {
    Write-Host "Device already booted: $serial"
    exit 0
}

# --- start it ---------------------------------------------------------------

if (-not $serial) {
    $avds = & $emulator -list-avds
    if ($avds -notcontains $Avd) {
        Write-Host "AVD '$Avd' not found. Available:" -ForegroundColor Yellow
        $avds | ForEach-Object { Write-Host "  $_" }
        throw "Create '$Avd' in Android Studio's Device Manager (must include the Play Store image)."
    }

    # -no-snapshot-load forces a cold boot.
    #
    # A saved snapshot can rot: the emulator then comes up, registers with adb
    # as 'offline', and sits there burning almost no CPU until this script's
    # timeout expires. It looks exactly like a slow machine, which sends you
    # hunting for CPU contention that is not there. Observed on Pixel_9a, where
    # a cold boot instead reached sys.boot_completed in about 80 seconds.
    #
    # Cold boot costs roughly a minute over a good snapshot restore. Paying it
    # every time is worth not debugging this again.
    $emuArgs = @('-avd', $Avd, '-netdelay', 'none', '-netspeed', 'full', '-no-snapshot-load')
    if ($NoBootAnim) { $emuArgs += '-no-boot-anim' }

    Write-Host "Starting emulator '$Avd' (cold boot)..."
    Start-Process -FilePath $emulator `
                  -ArgumentList $emuArgs `
                  -WindowStyle Minimized | Out-Null
} else {
    Write-Host "Device $serial attached but still booting..."
}

# --- wait -------------------------------------------------------------------

Write-Host "Waiting for boot (timeout ${TimeoutSec}s)..." -NoNewline
$deadline = (Get-Date).AddSeconds($TimeoutSec)

while ((Get-Date) -lt $deadline) {
    $serial = Get-OnlineDevice
    if ($serial -and (Test-BootCompleted -Serial $serial)) {
        Write-Host ''
        Write-Host "Booted: $serial" -ForegroundColor Green
        # Give the launcher a moment to settle so `am start` is not swallowed.
        Start-Sleep -Seconds 2
        exit 0
    }
    Write-Host '.' -NoNewline
    Start-Sleep -Seconds 3
}

Write-Host ''
throw "Emulator '$Avd' did not report sys.boot_completed=1 within ${TimeoutSec}s."
