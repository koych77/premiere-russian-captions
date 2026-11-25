#define Version "3.4.1"
[Setup]
AppId={{717FF47B-70D2-4971-8D98-139B84A08AA5}
AppName=Русские субтитры для Premiere
AppVersion={#Version}
AppPublisher=koych77
AppPublisherURL=https://github.com/koych77/premiere-russian-captions
AppUpdatesURL=https://github.com/koych77/premiere-russian-captions/releases/latest
DefaultDirName={localappdata}\Programs\RussianSubtitles
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=..\dist
OutputBaseFilename=RussianCaptions-Setup
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
CloseApplications=no
RestartApplications=no
UninstallDisplayName=Русские субтитры для Premiere
SetupLogging=yes
DiskSpanning=no
ExtraDiskSpaceRequired=1800000000

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[Files]
Source: "..\build\payload\panel\*"; DestDir: "{userappdata}\Adobe\CEP\extensions\local.russian.captions"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\build\payload\runtime\*"; DestDir: "{app}\runtime"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\build\payload\*.py"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\build\payload\*.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\build\payload\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\build\payload\models\speakers\*"; DestDir: "{app}\models\speakers"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{tmp}\model.bin"; DestDir: "{app}\models\large-v3-turbo"; Flags: external ignoreversion skipifsourcedoesntexist uninsneveruninstall
Source: "{tmp}\config.json"; DestDir: "{app}\models\large-v3-turbo"; Flags: external ignoreversion skipifsourcedoesntexist uninsneveruninstall
Source: "{tmp}\tokenizer.json"; DestDir: "{app}\models\large-v3-turbo"; Flags: external ignoreversion skipifsourcedoesntexist uninsneveruninstall
Source: "{tmp}\preprocessor_config.json"; DestDir: "{app}\models\large-v3-turbo"; Flags: external ignoreversion skipifsourcedoesntexist uninsneveruninstall
Source: "{tmp}\vocabulary.json"; DestDir: "{app}\models\large-v3-turbo"; Flags: external ignoreversion skipifsourcedoesntexist uninsneveruninstall

[Registry]
Root: HKCU; Subkey: "Software\Adobe\CSXS.11"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"
Root: HKCU; Subkey: "Software\Adobe\CSXS.12"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"
Root: HKCU; Subkey: "Software\Adobe\CSXS.13"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"

[Icons]
Name: "{userprograms}\Русские субтитры\Обновления"; Filename: "https://github.com/koych77/premiere-russian-captions/releases/latest"
Name: "{userprograms}\Русские субтитры\Удалить"; Filename: "{uninstallexe}"

[Code]
var DownloadPage: TDownloadWizardPage;

function OnDownloadProgress(const Url, FileName: String; const Progress, ProgressMax: Int64): Boolean;
begin
  Result := not DownloadPage.AbortedByUser;
end;

procedure InitializeWizard;
begin
  DownloadPage := CreateDownloadPage('Подготовка русского распознавания',
    'Первая установка: загрузка модели (1,6 ГБ). После установки распознавание работает без интернета.', @OnDownloadProgress);
  WizardForm.FinishedLabel.Caption := 'Готово! Открой Premiere: Окно → Расширения → Русские субтитры.';
end;

procedure EnsureModelFile(const FileName, Url, SHA256: String);
var Existing: String;
begin
  Existing := ExpandConstant('{app}\models\large-v3-turbo\') + FileName;
  if FileExists(Existing) then
    if CompareText(GetSHA256OfFile(Existing), SHA256) = 0 then exit;
  DownloadPage.Add(Url, FileName, SHA256);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var Code: Integer;
begin
  Result := '';
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -NonInteractive -Command "if (Get-Process -Name ''Adobe Premiere Pro'' -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"',
    '', SW_HIDE, ewWaitUntilTerminated, Code) then begin
    Result := 'Не удалось проверить, закрыт ли Premiere. Повтори установку.';
    exit;
  end;
  if Code <> 0 then begin
    Result := 'Сохрани проекты и закрой Adobe Premiere Pro, затем нажми «Повторить». Установщик не закрывает программу автоматически.';
    exit;
  end;
  DownloadPage.Clear;
  try
    #include "..\build\model-downloads.iss"
    DownloadPage.Show;
    try
      DownloadPage.Download;
    finally
      DownloadPage.Hide;
    end;
  except
    Result := 'Не удалось подготовить модель. Проверь подключение и повтори установку. ' + GetExceptionMessage;
  end;
end;
