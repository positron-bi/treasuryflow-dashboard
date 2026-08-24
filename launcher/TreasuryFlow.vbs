Option Explicit

Dim fso, shell, sharedHome, sourceRuntime, localRoot, localDir, localRuntime, pending
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

On Error Resume Next
sharedHome = fso.GetParentFolderName(WScript.ScriptFullName)
sourceRuntime = fso.BuildPath(sharedHome, "TreasuryFlow.runtime.v2.exe")
If Not fso.FileExists(sourceRuntime) Then
    shell.Popup "فایل TreasuryFlow.runtime.v2.exe در پوشه برنامه پیدا نشد.", 0, "TreasuryFlow", 16
    WScript.Quit 1
End If

localRoot = fso.BuildPath(shell.ExpandEnvironmentStrings("%LOCALAPPDATA%"), "Positron")
localDir = fso.BuildPath(localRoot, "TreasuryFlow")
If Not fso.FolderExists(localRoot) Then fso.CreateFolder localRoot
If Not fso.FolderExists(localDir) Then fso.CreateFolder localDir
If Err.Number <> 0 Then
    shell.Popup "ساخت پوشه محلی برنامه ناموفق بود:" & vbCrLf & Err.Description, 0, "TreasuryFlow", 16
    WScript.Quit 1
End If

localRuntime = fso.BuildPath(localDir, "TreasuryFlow.runtime.v2.exe")
If NeedsUpdate(sourceRuntime, localRuntime) Then
    pending = localRuntime & ".pending"
    If fso.FileExists(pending) Then fso.DeleteFile pending, True
    fso.CopyFile sourceRuntime, pending, True
    If Err.Number <> 0 Then
        shell.Popup "کپی نسخه جدید برنامه ناموفق بود:" & vbCrLf & Err.Description, 0, "TreasuryFlow", 16
        WScript.Quit 1
    End If
    If fso.FileExists(localRuntime) Then fso.DeleteFile localRuntime, True
    fso.MoveFile pending, localRuntime
    If Err.Number <> 0 Then
        shell.Popup "جایگزینی نسخه محلی ناموفق بود. برنامه باز را ببندید و دوباره تلاش کنید." & vbCrLf & Err.Description, 0, "TreasuryFlow", 16
        WScript.Quit 1
    End If
End If

shell.Environment("PROCESS")("TREASURYFLOW_HOME") = sharedHome
shell.Run Chr(34) & localRuntime & Chr(34), 1, False
If Err.Number <> 0 Then
    shell.Popup "اجرای TreasuryFlow ناموفق بود:" & vbCrLf & Err.Description, 0, "TreasuryFlow", 16
    WScript.Quit 1
End If

Function NeedsUpdate(sourcePath, targetPath)
    If Not fso.FileExists(targetPath) Then
        NeedsUpdate = True
        Exit Function
    End If
    Dim sourceFile, targetFile
    Set sourceFile = fso.GetFile(sourcePath)
    Set targetFile = fso.GetFile(targetPath)
    NeedsUpdate = (sourceFile.Size <> targetFile.Size) Or (sourceFile.DateLastModified <> targetFile.DateLastModified)
End Function
