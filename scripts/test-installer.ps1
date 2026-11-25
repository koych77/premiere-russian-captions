$ErrorActionPreference = 'Stop'
$setup = (Resolve-Path "$PSScriptRoot\..\dist\RussianCaptions-Setup.exe").Path
$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\RussianSubtitles'
$panelRoot = Join-Path $env:APPDATA 'Adobe\CEP\extensions\local.russian.captions'
if ((Test-Path $installRoot) -or (Test-Path $panelRoot)) { throw 'Installer smoke test requires a clean disposable runner' }
function Install-Test {
    $process = Start-Process -FilePath $setup -ArgumentList '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART' -WindowStyle Hidden -PassThru -Wait
    if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
}
Install-Test
$python = Join-Path $installRoot 'runtime\python.exe'
if (!(Test-Path (Join-Path $panelRoot 'CSXS\manifest.xml'))) { throw 'Panel was not installed' }
& $python "$PSScriptRoot\..\tests\test_renderer.py"
if ($LASTEXITCODE -ne 0) { throw 'Installed renderer failed' }
& $python -c 'import sys; from faster_whisper import WhisperModel; WhisperModel(sys.argv[1], device="cpu", compute_type="int8", local_files_only=True); print("Installed ASR model loaded on CPU")' (Join-Path $installRoot 'models\large-v3-turbo')
if ($LASTEXITCODE -ne 0) { throw 'Installed ASR model failed' }
& $python "$PSScriptRoot\..\tests\test_speaker_runtime.py" $installRoot
if ($LASTEXITCODE -ne 0) { throw 'Installed speaker runtime failed' }
$state = Join-Path $installRoot 'premiere-panel'
New-Item -ItemType Directory -Path $state -Force | Out-Null
$sentinel = Join-Path $state 'settings-preservation-test.json'
'{"preserve":"user settings"}' | Set-Content -LiteralPath $sentinel
$before = (Get-FileHash -LiteralPath $sentinel).Hash
$model = Join-Path $installRoot 'models\large-v3-turbo\model.bin'
$modelTime = (Get-Item -LiteralPath $model).LastWriteTimeUtc
Install-Test
if ((Get-FileHash -LiteralPath $sentinel).Hash -ne $before) { throw 'Update changed user settings' }
if ((Get-Item -LiteralPath $model).LastWriteTimeUtc -ne $modelTime) { throw 'Update unnecessarily replaced model' }
$uninstaller = Join-Path $installRoot 'unins000.exe'
$process = Start-Process -FilePath $uninstaller -ArgumentList '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART' -WindowStyle Hidden -PassThru -Wait
if ($process.ExitCode -ne 0) { throw 'Uninstaller failed' }
if (!(Test-Path -LiteralPath $sentinel) -or !(Test-Path -LiteralPath $model)) { throw 'Uninstaller removed user data or cached model' }
if (Test-Path -LiteralPath (Join-Path $panelRoot 'index.html')) { throw 'Uninstaller left panel installed' }
Write-Output 'PASS: clean install, portable runtime, model load, update preserves settings/model, uninstall preserves user data'
