# Registers a Task Scheduler task on Windows that runs at system startup to keep WSL2
# running in the background for Splitune systemd workers (09c §7).
param (
    [string]$Distro = "Ubuntu-24.04",
    [string]$TaskName = "SplituneWSLWorkerKeepalive"
)

$Action = New-ScheduledTaskAction -Execute "wsl.exe" -Argument "-d $Distro --exec sleep infinity"
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force
Write-Host "Registered scheduled task '$TaskName' to keep $Distro alive at startup."
