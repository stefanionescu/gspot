# Observes the planted suite independently of the Bun subprocess wait.
[CmdletBinding()]
param([switch] $Coverage)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'Process trace observation requires Windows.' }

$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$label = if ($Coverage) { 'coverage' } else { 'ordinary' }
$output = Join-Path $root "dist/process-observation/$label"
[void] [IO.Directory]::CreateDirectory($output)
$records = [Collections.Generic.List[object]]::new()
$observations = [Collections.Generic.List[object]]::new()
$processes = [Collections.Generic.List[Diagnostics.Process]]::new()
$subscriptions = [Collections.Generic.List[string]]::new()
$failures = [Collections.Generic.List[string]]::new()
$unavailable = [Collections.Generic.List[string]]::new()
$related = [Collections.Generic.List[object]]::new()
$command = @('test', 'tests/repositories/shell-checks.test.ts')
if ($Coverage) { $command += '--coverage' }
$bun = (Get-Command bun -CommandType Application).Source
$version = & $bun --version
if ($LASTEXITCODE -ne 0) { throw 'Cannot read the Bun version.' }
$child = [Diagnostics.Process]::new()
$child.StartInfo.FileName = $bun
$child.StartInfo.WorkingDirectory = $root
$child.StartInfo.UseShellExecute = $false
$child.StartInfo.RedirectStandardOutput = $true
$child.StartInfo.RedirectStandardError = $true
foreach ($argument in $command) { $child.StartInfo.ArgumentList.Add($argument) }
$stdout = [IO.File]::Create((Join-Path $output 'stdout.log'))
$stderr = [IO.File]::Create((Join-Path $output 'stderr.log'))
$timer = [Diagnostics.Stopwatch]::StartNew()
$exitCode = 1
$started = $false
$copies = @()

# Keep event timestamps, including stop events, so PID reuse cannot merge lifetimes.
function Get-TraceEvents {
    foreach ($identifier in $subscriptions) {
        foreach ($event in @(Get-Event | Where-Object SourceIdentifier -EQ $identifier)) {
            $trace = $event.SourceEventArgs.NewEvent
            $record = [ordered]@{
                kind = $identifier.Split('.')[-1]
                pid = [int] $trace.ProcessID
                parent_pid = [int] $trace.ParentProcessID
                name = $trace.ProcessName
                time = [DateTime]::FromFileTimeUtc([long] $trace.TIME_CREATED).ToString('o')
            }
            if ($record.kind -eq 'stop') { $record.exit_status = $trace.ExitStatus }
            $records.Add([pscustomobject] $record)
            Remove-Event -EventIdentifier $event.EventIdentifier
        }
    }
}

# A retained native handle identifies one process even after its PID is reused.
function Get-NativeState {
    foreach ($process in $processes) {
        $state = [ordered]@{
            pid = $process.Id
            created = $process.StartTime.ToUniversalTime().ToString('o')
            observed = [DateTime]::UtcNow.ToString('o')
            elapsed_ms = $timer.ElapsedMilliseconds
            exited = $process.HasExited
        }
        if ($state.exited) { $state.exit_code = $process.ExitCode }
        $observations.Add([pscustomobject] $state)
    }
}

try {
    foreach ($kind in @('start', 'stop')) {
        $identifier = "gspot.$PID.$kind"
        $class = if ($kind -eq 'start') { 'Win32_ProcessStartTrace' } else { 'Win32_ProcessStopTrace' }
        Register-CimIndicationEvent -ClassName $class -SourceIdentifier $identifier | Out-Null
        $subscriptions.Add($identifier)
    }
    $started = $child.Start()
    if (-not $started) { throw 'The observed process did not start.' }
    $null = $child.SafeHandle
    $processes.Add($child)
    $related.Add([pscustomobject]@{ pid = $child.Id; time = $child.StartTime.ToUniversalTime().ToString('o') })
    $copies = @($child.StandardOutput.BaseStream.CopyToAsync($stdout), $child.StandardError.BaseStream.CopyToAsync($stderr))
    $lastSnapshot = -1000L
    $seen = [Collections.Generic.HashSet[string]]::new()
    while (-not $child.HasExited -and $timer.Elapsed.TotalSeconds -lt 900) {
        Get-TraceEvents
        # Match parent lifetimes before opening a handle. A missing handle is not proof of liveness.
        foreach ($record in @($records | Sort-Object time)) {
            if ($record.kind -ne 'start' -or $record.pid -eq $child.Id) { continue }
            $parents = @($related | Where-Object { $_.pid -eq $record.parent_pid -and $_.time -le $record.time })
            if ($parents.Count -eq 0) { continue }
            $parent = $parents[-1]
            $stops = @($records | Where-Object {
                $_.kind -eq 'stop' -and $_.pid -eq $parent.pid -and $_.time -ge $parent.time -and $_.time -lt $record.time
            })
            if ($stops.Count -gt 0) { continue }
            $key = "$($record.pid):$($record.time)"
            if (-not $seen.Add($key)) { continue }
            $related.Add($record)
            try {
                $process = [Diagnostics.Process]::GetProcessById($record.pid)
                $created = $process.StartTime.ToUniversalTime()
                if ($created -gt [DateTime]::Parse($record.time).ToUniversalTime()) {
                    $process.Dispose()
                    $unavailable.Add("PID reused before native observation: $key")
                    continue
                }
                $null = $process.SafeHandle
                $processes.Add($process)
            } catch {
                $unavailable.Add("Native observation unavailable for $key : $($_.Exception.Message)")
            }
        }
        if ($timer.ElapsedMilliseconds - $lastSnapshot -ge 1000) {
            Get-NativeState
            $lastSnapshot = $timer.ElapsedMilliseconds
        }
        Start-Sleep -Milliseconds 20
    }
    Get-NativeState
    if ($child.HasExited) {
        $exitCode = $child.ExitCode
    } else {
        $failures.Add('The observer reached its 900-second suite deadline. Native state precedes termination.')
        $exitCode = 124
        $child.Kill($true)
        if (-not $child.WaitForExit(5000)) { $failures.Add('The observed process did not terminate after cancellation.') }
    }
    # A pipe held by a descendant must not turn observation into another unbounded wait.
    $drain = [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]] $copies)
    if (-not $drain.Wait(5000)) { $failures.Add('Output streams did not close within five seconds of process exit.') }
} catch {
    $failures.Add("Observation failed: $($_.Exception.Message)")
} finally {
    if ($started -and -not $child.HasExited) {
        $child.Kill($true)
        [void] $child.WaitForExit(5000)
    }
    try { Get-TraceEvents } catch { $failures.Add("Trace collection failed: $($_.Exception.Message)") }
    foreach ($identifier in $subscriptions) {
        Unregister-Event -SourceIdentifier $identifier
        Get-Event | Where-Object SourceIdentifier -EQ $identifier | Remove-Event
    }
    $stdout.Dispose()
    $stderr.Dispose()
    $report = [ordered]@{
        command = @($bun) + $command
        cwd = $root
        bun = $version
        powershell = $PSVersionTable.PSVersion.ToString()
        os = [Environment]::OSVersion.VersionString
        coverage = [bool] $Coverage
        elapsed_ms = $timer.ElapsedMilliseconds
        root_pid = if ($started) { $child.Id } else { $null }
        exit_code = $exitCode
        failures = @($failures.ToArray())
        unavailable = @($unavailable.ToArray())
        events = @($records.ToArray() | Where-Object {
            $trace = $_
            @($related | Where-Object { $_.pid -eq $trace.pid -and $_.time -le $trace.time }).Count -gt 0
        } | Sort-Object time)
        native = @($observations.ToArray())
    }
    $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $output 'observation.json') -Encoding utf8
    foreach ($process in $processes) { $process.Dispose() }
    if (-not $started) { $child.Dispose() }
}
Get-Content -LiteralPath (Join-Path $output 'stdout.log')
Get-Content -LiteralPath (Join-Path $output 'stderr.log')
foreach ($failure in $failures) { [Console]::Error.WriteLine($failure) }
if ($exitCode -eq 0 -and $failures.Count -gt 0) { exit 1 }
exit $exitCode
