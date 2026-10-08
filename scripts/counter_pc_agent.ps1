<#
=============================================================================
 Ideal Photo Studio — Authorized Counter PC Power & Attendance Tracker Agent
 Shop # 45, Post Office Market HIT, Taxila Cantt
 ---------------------------------------------------------------------------
 Automatically tracks:
 1. Exact Morning PC Turn-On / Boot Time (Shop Opening)
 2. Evening PC Turn-Off / Shutdown Time (Shop Closing around 9:30 PM)
 3. Automatically records Alex sotra's attendance with true PC boot timestamp
 4. Filters out & ignores mid-day light shortages / load shedding (Pakistan power cuts)
 5. Telemetry is saved directly to Supabase and visible to ADMIN ONLY
=============================================================================
#>

param(
    [string]$Action = "run",       # "run" (daemon), "sync-once", "status", "test"
    [int]$IntervalSec = 60
)

$ErrorActionPreference = "SilentlyContinue"

$SupabaseUrl = "https://hrsashyglcwtxfrrcnvj.supabase.co"
$AnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc2FzaHlnbGN3dHhmcnJjbnZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1ODM4MjcsImV4cCI6MjEwMTE1OTgyN30.W_gjnC21uE1DrydCznEGsdnlxQ8MwzyyzkP2aCkZbAE"

$Headers = @{
    "apikey"        = $AnonKey
    "Authorization" = "Bearer $AnonKey"
    "Content-Type"  = "application/json"
    "Prefer"        = "resolution=merge-duplicates"
}

function Write-Log([string]$msg) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Write-Host "[$timestamp] $msg"
}

# Fetch opening rules & morning opener from Supabase
function Get-ShopRules {
    $defaultRules = @{
        shopOpenTime = "08:45"
        graceMinutes = 15
        morningOpener = "Alex sotra"
    }

    try {
        $res = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/sales?customer=eq.__SHOP_HOURS__&limit=1" -Headers $Headers -Method Get -TimeoutSec 10
        if ($res -and $res.Count -gt 0 -and $res[0].items -and $res[0].items[0]) {
            $item = $res[0].items[0]
            if ($item.shopOpenTime) { $defaultRules.shopOpenTime = $item.shopOpenTime }
            if ($item.graceMinutes -ne $null) { $defaultRules.graceMinutes = [int]$item.graceMinutes }
            if ($item.morningOpener) { $defaultRules.morningOpener = $item.morningOpener }
        }
    } catch {
        Write-Log "Warning: Could not fetch remote shop rules, using defaults (08:45 + 15m grace for Alex sotra)."
    }
    return $defaultRules
}

# Analyze Windows OS Boot, Shutdown, Sleep, and Load-Shedding events
function Get-PCPowerAudit([datetime]$TargetDate) {
    $startOfDay = $TargetDate.Date
    $endOfDay = $startOfDay.AddDays(1).AddTicks(-1)

    # 1. System LastBootUpTime
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    $lastBoot = if ($os) { $os.LastBootUpTime } else { $null }

    # 2. Query Windows Event Log:
    # 6005 = Boot, 6006 = Clean shutdown, 6008 = Unexpected shutdown (Light cut / load shedding), 1074 = User shutdown
    # 12 = Kernel-General boot, 13 = Kernel-General shutdown
    # 1 = Power-Troubleshooter wake from sleep, 107 = Kernel-Power wake, 42 = Sleep
    $events = Get-WinEvent -FilterHashtable @{
        LogName = 'System'
        StartTime = $startOfDay.AddHours(-14) # Inspect from previous night
        EndTime = (Get-Date)
    } -ErrorAction SilentlyContinue | Where-Object {
        $_.Id -in @(6005, 6006, 6008, 1074, 1, 12, 13, 42, 107)
    } | Sort-Object TimeCreated

    $morningBootTs = $null
    $morningBootTimeStr = $null
    $eveningShutdownTs = $null
    $eveningShutdownTimeStr = $null
    $outages = @()

    # Identify today's power-up / boot / wake events
    $todayPowerUps = $events | Where-Object {
        $_.TimeCreated -ge $startOfDay -and $_.TimeCreated -le $endOfDay -and
        ($_.Id -in @(6005, 12, 1, 107))
    }

    if ($todayPowerUps -and $todayPowerUps.Count -gt 0) {
        $firstPowerUp = $todayPowerUps[0]
        $morningBootTs = ([DateTimeOffset]$firstPowerUp.TimeCreated.ToUniversalTime()).ToUnixTimeMilliseconds()
        $morningBootTimeStr = $firstPowerUp.TimeCreated.ToString("hh:mm:ss tt")
    } elseif ($lastBoot -and $lastBoot -ge $startOfDay -and $lastBoot -le $endOfDay) {
        $morningBootTs = ([DateTimeOffset]$lastBoot.ToUniversalTime()).ToUnixTimeMilliseconds()
        $morningBootTimeStr = $lastBoot.ToString("hh:mm:ss tt")
    } else {
        # Fallback: if PC booted before midnight and woke today, find first wake or default to current time
        if ($todayPowerUps -and $todayPowerUps.Count -gt 0) {
            $firstPowerUp = $todayPowerUps[0]
            $morningBootTs = ([DateTimeOffset]$firstPowerUp.TimeCreated.ToUniversalTime()).ToUnixTimeMilliseconds()
            $morningBootTimeStr = $firstPowerUp.TimeCreated.ToString("hh:mm:ss tt")
        } else {
            $now = Get-Date
            $morningBootTs = ([DateTimeOffset]$now.ToUniversalTime()).ToUnixTimeMilliseconds()
            $morningBootTimeStr = $now.ToString("hh:mm:ss tt")
        }
    }

    # Identify today's shutdown / sleep events
    $todayShutdowns = $events | Where-Object {
        $_.TimeCreated -ge $startOfDay -and $_.TimeCreated -le $endOfDay -and
        ($_.Id -in @(6006, 6008, 1074, 13, 42))
    }

    foreach ($sd in $todayShutdowns) {
        $sdTime = $sd.TimeCreated

        # MID-DAY LIGHT SHORTAGE / LOAD SHEDDING (Between 09:30 AM and 08:30 PM)
        # In Pakistan, midday power outages happen frequently. We ignore them for shop opening/closing metrics!
        if ($sdTime.Hour -ge 9 -and $sdTime.Hour -lt 20) {
            $resume = $todayPowerUps | Where-Object { $_.TimeCreated -gt $sdTime } | Select-Object -First 1
            $durMins = 0
            $resumeTimeStr = "In Progress / Restoring"
            if ($resume) {
                $durMins = [math]::Max(1, [math]::Round(($resume.TimeCreated - $sdTime).TotalMinutes))
                $resumeTimeStr = $resume.TimeCreated.ToString("hh:mm:ss tt")
            }
            $isUnexpected = ($sd.Id -eq 6008)
            $outages += @{
                start = $sdTime.ToString("hh:mm:ss tt")
                startTs = ([DateTimeOffset]$sdTime.ToUniversalTime()).ToUnixTimeMilliseconds()
                end = $resumeTimeStr
                durationMins = $durMins
                type = if ($isUnexpected) { "load_shedding" } else { "midday_power_cut" }
                eventId = $sd.Id
                note = if ($isUnexpected) { "Midday light shortage / unexpected power cut (Ignored)" } else { "Midday power down / reboot (Ignored)" }
            }
        }
        # EVENING SHUTDOWN (Around or after 08:30 PM / 09:30 PM closing)
        elseif ($sdTime.Hour -ge 20 -or ($sdTime.Hour -eq 9 -and $sdTime.Minute -ge 30 -and $sdTime.Hour -ge 20)) {
            $eveningShutdownTs = ([DateTimeOffset]$sdTime.ToUniversalTime()).ToUnixTimeMilliseconds()
            $eveningShutdownTimeStr = $sdTime.ToString("hh:mm:ss tt")
        }
    }

    # Also check if yesterday evening's shutdown is recorded for the previous day
    $yesterdayDate = $TargetDate.AddDays(-1).ToString("yyyy-MM-dd")
    $prevEveningShutdown = $events | Where-Object {
        $_.TimeCreated -lt $startOfDay -and $_.TimeCreated.Hour -ge 19 -and
        ($_.Id -in @(6006, 6008, 1074, 13))
    } | Select-Object -Last 1

    return @{
        date = $TargetDate.ToString("yyyy-MM-dd")
        terminal = "Authorized Counter PC"
        morningBootTs = $morningBootTs
        morningBootTime = $morningBootTimeStr
        eveningShutdownTs = $eveningShutdownTs
        eveningShutdownTime = $eveningShutdownTimeStr
        outages = $outages
        yesterdayDate = $yesterdayDate
        yesterdayShutdown = if ($prevEveningShutdown) { $prevEveningShutdown.TimeCreated.ToString("hh:mm:ss tt") } else { $null }
        yesterdayShutdownTs = if ($prevEveningShutdown) { ([DateTimeOffset]$prevEveningShutdown.TimeCreated.ToUniversalTime()).ToUnixTimeMilliseconds() } else { $null }
        lastHeartbeatTs = ([DateTimeOffset]::UtcNow).ToUnixTimeMilliseconds()
        lastHeartbeatTime = (Get-Date).ToString("hh:mm:ss tt")
        status = "online"
        machineName = $env:COMPUTERNAME
    }
}

# Calculate punctuality against shop rules
function Get-Punctuality([int64]$bootTs, [hashtable]$rules) {
    $bootDate = [DateTimeOffset]::FromUnixTimeMilliseconds($bootTs).LocalDateTime
    $openParts = ($rules.shopOpenTime -split ':')
    $targetHour = [int]$openParts[0]
    $targetMin = [int]$openParts[1]
    $grace = [int]$rules.graceMinutes

    $scheduledDate = New-Object DateTime($bootDate.Year, $bootDate.Month, $bootDate.Day, $targetHour, $targetMin, 0)
    $graceDeadline = $scheduledDate.AddMinutes($grace)

    $isLate = ($bootDate -gt $graceDeadline)
    $lateMins = 0
    if ($isLate) {
        $lateMins = [math]::Max(0, [math]::Round(($bootDate - $scheduledDate).TotalMinutes))
    }

    return @{
        isLate = $isLate
        lateMinutes = $lateMins
        scheduledTime = $rules.shopOpenTime
        scheduledDisplay = $scheduledDate.ToString("hh:mm tt")
        punchDisplay = $bootDate.ToString("hh:mm:ss tt")
    }
}

# Sync PC Power Log and Alex Sotra Attendance to Supabase
function Sync-ToSupabase([hashtable]$powerAudit, [hashtable]$rules) {
    $todayStr = $powerAudit.date
    $powerId = "PC-POWER-$todayStr"

    Write-Log "Syncing Counter PC Power Log ($powerId) to Supabase..."

    # 1. UPSERT PC POWER LOG
    $powerPayload = @(
        @{
            id = $powerId
            ts = $powerAudit.lastHeartbeatTs
            staff = "Auth Counter PC"
            customer = "__PC_POWER_LOG__"
            phone = $todayStr
            items = @($powerAudit)
            total = 0
            paid = 0
            balance = 0
        }
    )

    try {
        $json = $powerPayload | ConvertTo-Json -Depth 6
        $res = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/sales" -Method Post -Headers $Headers -Body $json -TimeoutSec 15
        Write-Log "✅ Counter PC Power Log synced successfully."
    } catch {
        Write-Log "❌ Error syncing PC Power Log: $_"
    }

    # 2. CHECK & AUTO-MARK ALEX SOTRA'S ATTENDANCE
    $openerName = if ($rules.morningOpener) { $rules.morningOpener } else { "Alex sotra" }
    try {
        # Check if attendance already exists for today for opener
        $attQuery = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/sales?customer=eq.__ATTENDANCE__&phone=eq.$todayStr" -Headers $Headers -Method Get -TimeoutSec 15
        
        $existingRecord = $null
        if ($attQuery -and $attQuery.Count -gt 0) {
            foreach ($row in $attQuery) {
                if ($row.items -and $row.items[0]) {
                    $item = $row.items[0]
                    # Match Alex sotra or Alex
                    if ($item.staff -eq $openerName -or 
                        ($openerName -like "*Alex*" -and $item.staff -like "*Alex*")) {
                        $existingRecord = $item
                        break
                    }
                }
            }
        }

        $punctuality = Get-Punctuality $powerAudit.morningBootTs $rules

        if (-not $existingRecord) {
            # No record yet today: Create attendance record stamped with EXACT PC BOOT TIME!
            $attId = "ATT-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
            $attNote = if ($punctuality.isLate) {
                "⚠️ PC Boot Auto-Attendance · Late by $($punctuality.lateMinutes)m (Shift: $($punctuality.scheduledDisplay) · PC Turned on: $($punctuality.punchDisplay))"
            } else {
                "✅ PC Boot Auto-Attendance · On-Time (Shift: $($punctuality.scheduledDisplay) · PC Turned on: $($punctuality.punchDisplay))"
            }

            $attItem = @{
                id = $attId
                ts = $powerAudit.morningBootTs
                date = $todayStr
                staff = $openerName
                clockIn = $powerAudit.morningBootTs
                clockOut = $null
                breaks = @()
                totalWorkMinutes = 0
                status = "clocked_in"
                isLate = $punctuality.isLate
                lateMinutes = $punctuality.lateMinutes
                notes = $attNote
                isManual = $false
                autoCaptured = $true
                hardwareCaptured = $true
                pcBootTime = $powerAudit.morningBootTime
                updatedAt = ([DateTimeOffset]::UtcNow).ToUnixTimeMilliseconds()
            }

            $attPayload = @(
                @{
                    id = $attId
                    ts = $powerAudit.morningBootTs
                    staff = $openerName
                    customer = "__ATTENDANCE__"
                    phone = $todayStr
                    items = @($attItem)
                    total = 0
                    paid = 0
                    balance = 0
                }
            )

            $attJson = $attPayload | ConvertTo-Json -Depth 6
            Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/sales" -Method Post -Headers $Headers -Body $attJson -TimeoutSec 15
            Write-Log "✅ Auto-marked $openerName attendance with PC Power-On time: $($punctuality.punchDisplay) (Late: $($punctuality.lateMinutes)m)"
        } else {
            # If attendance was created by browser or has a later clockIn than PC boot time,
            # align it with the true PC hardware power-on time so Alex is not penalized for browser opening delay!
            if ($existingRecord.autoCaptured -and $existingRecord.clockIn -gt ($powerAudit.morningBootTs + 180000)) {
                Write-Log "Aligning existing attendance clockIn ($($existingRecord.clockIn)) with true PC boot time ($($powerAudit.morningBootTs))..."
                $existingRecord.clockIn = $powerAudit.morningBootTs
                $existingRecord.ts = $powerAudit.morningBootTs
                $existingRecord.isLate = $punctuality.isLate
                $existingRecord.lateMinutes = $punctuality.lateMinutes
                $existingRecord.pcBootTime = $powerAudit.morningBootTime
                $existingRecord.notes = if ($punctuality.isLate) {
                    "⚠️ PC Boot Auto-Attendance · Late by $($punctuality.lateMinutes)m (Shift: $($punctuality.scheduledDisplay) · PC Turned on: $($punctuality.punchDisplay))"
                } else {
                    "✅ PC Boot Auto-Attendance · On-Time (Shift: $($punctuality.scheduledDisplay) · PC Turned on: $($punctuality.punchDisplay))"
                }

                $updatePayload = @(
                    @{
                        id = $existingRecord.id
                        ts = $powerAudit.morningBootTs
                        staff = $existingRecord.staff
                        customer = "__ATTENDANCE__"
                        phone = $todayStr
                        items = @($existingRecord)
                        total = 0
                        paid = 0
                        balance = 0
                    }
                )
                $updJson = $updatePayload | ConvertTo-Json -Depth 6
                Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/sales" -Method Post -Headers $Headers -Body $updJson -TimeoutSec 15
                Write-Log "✅ Aligned existing attendance to true PC Power-On time."
            } else {
                Write-Log "Opener ($openerName) attendance is already recorded for today."
            }
        }
    } catch {
        Write-Log "❌ Error checking/syncing opener attendance: $_"
    }

    # 3. If yesterday had an evening shutdown that wasn't recorded, update yesterday's power log
    if ($powerAudit.yesterdayDate -and $powerAudit.yesterdayShutdownTs) {
        $yesterdayId = "PC-POWER-$($powerAudit.yesterdayDate)"
        try {
            $yQuery = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/sales?id=eq.$yesterdayId&limit=1" -Headers $Headers -Method Get -TimeoutSec 10
            if ($yQuery -and $yQuery.Count -gt 0 -and $yQuery[0].items -and $yQuery[0].items[0]) {
                $yItem = $yQuery[0].items[0]
                if (-not $yItem.eveningShutdownTs) {
                    $yItem.eveningShutdownTs = $powerAudit.yesterdayShutdownTs
                    $yItem.eveningShutdownTime = $powerAudit.yesterdayShutdown
                    $yItem.status = "closed"
                    $yPayload = @(
                        @{
                            id = $yesterdayId
                            ts = $powerAudit.yesterdayShutdownTs
                            staff = "Auth Counter PC"
                            customer = "__PC_POWER_LOG__"
                            phone = $powerAudit.yesterdayDate
                            items = @($yItem)
                            total = 0
                            paid = 0
                            balance = 0
                        }
                    )
                    $yJson = $yPayload | ConvertTo-Json -Depth 6
                    Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/sales" -Method Post -Headers $Headers -Body $yJson -TimeoutSec 10
                    Write-Log "✅ Updated yesterday's closing shutdown time: $($powerAudit.yesterdayShutdown)"
                }
            }
        } catch {}
    }
}

# Run one-off sync or continuous daemon
if ($Action -eq "sync-once" -or $Action -eq "test") {
    Write-Log "Running one-time Counter PC power audit and Supabase sync..."
    $rules = Get-ShopRules
    $audit = Get-PCPowerAudit (Get-Date)
    Write-Log "Morning PC Power-On: $($audit.morningBootTime) (Timestamp: $($audit.morningBootTs))"
    Write-Log "Evening Shutdown: $($audit.eveningShutdownTime)"
    Write-Log "Midday light shortages detected: $($audit.outages.Count)"
    foreach ($outage in $audit.outages) {
        Write-Log "   -> Light shortage: $($outage.start) to $($outage.end) ($($outage.durationMins) mins) [Ignored for Shop Close]"
    }
    Sync-ToSupabase $audit $rules
    Write-Log "Sync complete."
} else {
    Write-Log "Starting Ideal Studio Counter PC Power & Attendance Background Tracker..."
    Write-Log "Listening for boot, shutdown, and load shedding events (Interval: ${IntervalSec}s)..."

    # Initial sync on launch / Windows boot
    $rules = Get-ShopRules
    $audit = Get-PCPowerAudit (Get-Date)
    Sync-ToSupabase $audit $rules

    $counter = 0
    while ($true) {
        Start-Sleep -Seconds $IntervalSec
        $counter++

        # Every 5 minutes or upon new events, re-audit and sync
        try {
            $currentDate = Get-Date
            $audit = Get-PCPowerAudit $currentDate
            
            # Periodically update heartbeat & checks
            if ($counter % 5 -eq 0) {
                $rules = Get-ShopRules
                Sync-ToSupabase $audit $rules
            } else {
                # Quick heartbeat update
                $powerId = "PC-POWER-$($audit.date)"
                $quickPayload = @(
                    @{
                        id = $powerId
                        ts = ([DateTimeOffset]::UtcNow).ToUnixTimeMilliseconds()
                        staff = "Auth Counter PC"
                        customer = "__PC_POWER_LOG__"
                        phone = $audit.date
                        items = @($audit)
                        total = 0
                        paid = 0
                        balance = 0
                    }
                )
                $quickJson = $quickPayload | ConvertTo-Json -Depth 6
                Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/sales" -Method Post -Headers $Headers -Body $quickJson -TimeoutSec 10 | Out-Null
            }
        } catch {
            Write-Log "Heartbeat error: $_"
        }
    }
}
