# MineServer Agent - Install as Windows Startup program
# Run this script as Administrator to install the agent as a scheduled task

param(
  [switch]$Install,
  [switch]$Uninstall,
  [switch]$Status
)

$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentExe = Join-Path $agentDir "mineserver-agent.exe"
$agentJs = Join-Path $agentDir "index.js"
$taskName = "MineServerAgent"

# If using Node directly (not packaged)
if (-not (Test-Path $agentExe)) {
  $nodePath = (Get-Command node).Source
  $agentExe = $nodePath
  $agentArgs = @($agentJs)
} else {
  $agentArgs = @()
}

function Install-Agent {
  Write-Host "Installing MineServer Agent as scheduled task..." -ForegroundColor Cyan
  
  # Check if Node is available for JS runner
  if (-not (Get-Command node -ErrorAction SilentlyContinue) -and -not (Test-Path $agentExe)) {
    Write-Host "ERROR: Node.js not found and mineserver-agent.exe not found." -ForegroundColor Red
    Write-Host "Install Node.js from https://nodejs.org or package the agent with pkg." -ForegroundColor Yellow
    exit 1
  }

  # Install npm dependencies if needed
  if (Test-Path (Join-Path $agentDir "package.json")) {
    $nodeModules = Join-Path $agentDir "node_modules"
    if (-not (Test-Path $nodeModules)) {
      Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
      Push-Location $agentDir
      npm install
      Pop-Location
    }
  }

  # Create scheduled task to run on user logon
  $action = New-ScheduledTaskAction -Execute $agentExe -Argument $agentArgs -WorkingDirectory $agentDir
  $trigger = New-ScheduledTaskTrigger -AtLogon -User $env:USERNAME
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force

  Write-Host "✓ MineServer Agent installed as scheduled task." -ForegroundColor Green
  Write-Host "To start now, run: Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Yellow
}

function Uninstall-Agent {
  Write-Host "Uninstalling MineServer Agent..." -ForegroundColor Cyan
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "✓ MineServer Agent uninstalled." -ForegroundColor Green
}

function Show-Status {
  $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if ($task) {
    Write-Host "MineServer Agent: INSTALLED" -ForegroundColor Green
    Write-Host "Status: $($task.State)"
  } else {
    Write-Host "MineServer Agent: NOT INSTALLED" -ForegroundColor Yellow
  }
}

if ($Install) { Install-Agent }
elseif ($Uninstall) { Uninstall-Agent }
elseif ($Status) { Show-Status }
else {
  Write-Host "MineServer Agent - Windows Startup Installer" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "Usage:" -ForegroundColor White
  Write-Host "  .\install-service.ps1 -Install    Install the agent as a startup task" -ForegroundColor Yellow
  Write-Host "  .\install-service.ps1 -Uninstall  Remove the agent task" -ForegroundColor Yellow
  Write-Host "  .\install-service.ps1 -Status     Check if agent is installed" -ForegroundColor Yellow
}
