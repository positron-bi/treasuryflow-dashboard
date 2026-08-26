Option Explicit

Dim fso, shell, appRoot, sharedHome, runtime, accessFile, publishRepo, runCommand
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

appRoot = fso.GetParentFolderName(WScript.ScriptFullName)
sharedHome = "X:\Accounting\report flow"
runtime = fso.BuildPath(appRoot, "TreasuryFlow.Main.exe")
accessFile = fso.BuildPath(fso.BuildPath(shell.ExpandEnvironmentStrings("%USERPROFILE%"), "Desktop\DashboardAccess"), "dashboard_users.xlsx")
publishRepo = fso.BuildPath(appRoot, "treasuryflow-dashboard")

If Not fso.FileExists(runtime) Then
    shell.Popup "فایل برنامه اصلی پیدا نشد.", 0, "TreasuryFlow Main", 16
    WScript.Quit 1
End If
If Not fso.FolderExists(sharedHome) Then
    shell.Popup "پوشه شبکه X:\Accounting\report flow در دسترس نیست.", 0, "TreasuryFlow Main", 16
    WScript.Quit 1
End If
If Not fso.FileExists(accessFile) Then
    shell.Popup "فایل dashboard_users.xlsx روی Desktop\DashboardAccess پیدا نشد.", 0, "TreasuryFlow Main", 16
    WScript.Quit 1
End If
If Not fso.FolderExists(publishRepo) Then
    shell.Popup "پوشه کد treasuryflow-dashboard پیدا نشد.", 0, "TreasuryFlow Main", 16
    WScript.Quit 1
End If

shell.Environment("PROCESS")("TREASURYFLOW_ROLE") = "processor"
shell.Environment("PROCESS")("TREASURYFLOW_HOME") = sharedHome
shell.Environment("PROCESS")("TREASURYFLOW_ACCESS_FILE") = accessFile
shell.Environment("PROCESS")("TREASURYFLOW_PUBLISH_REPO") = publishRepo
runCommand = Chr(34) & runtime & Chr(34)
shell.Run runCommand, 1, False

If Err.Number <> 0 Then
    shell.Popup "اجرای برنامه اصلی ناموفق بود:" & vbCrLf & Err.Description, 0, "TreasuryFlow Main", 16
    WScript.Quit 1
End If
