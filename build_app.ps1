$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

python -m pip install --disable-pip-version-check -r requirements-dev.txt
python -m PyInstaller --noconfirm --clean TreasuryFlow.spec

$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path -LiteralPath $csc)) {
    throw "C# compiler not found: $csc"
}
& $csc /nologo /target:winexe /optimize+ /reference:System.Windows.Forms.dll /out:"$PSScriptRoot\dist\TreasuryFlow.exe" "$PSScriptRoot\launcher\TreasuryFlowLauncher.cs"

Write-Host "Built launcher: $PSScriptRoot\dist\TreasuryFlow.exe"
Write-Host "Built runtime:  $PSScriptRoot\dist\TreasuryFlow.runtime.exe"
