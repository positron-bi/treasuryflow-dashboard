$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $projectRoot "uploader\TreasuryFlowUploader.cs"
$outputDir = Join-Path $projectRoot "dist"
$output = Join-Path $outputDir "TreasuryFlowUploader.exe"
$compiler = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
& $compiler /nologo /target:winexe /optimize+ /codepage:65001 /reference:System.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /out:$output $source
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "Built: $output"
