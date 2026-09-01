Option Explicit

Dim fso, shell, sharedHome, sourceExe, localRoot, localDir, localExe, pending
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

On Error Resume Next
sharedHome = fso.GetParentFolderName(WScript.ScriptFullName)
sourceExe = fso.BuildPath(sharedHome, "TreasuryFlowUploader.exe")
localRoot = fso.BuildPath(shell.ExpandEnvironmentStrings("%LOCALAPPDATA%"), "Positron")
localDir = fso.BuildPath(localRoot, "TreasuryFlowUploader")
localExe = fso.BuildPath(localDir, "TreasuryFlowUploader.exe")

If Not fso.FileExists(sourceExe) Then
    shell.Popup "TreasuryFlow uploader was not found on the shared drive.", 0, "TreasuryFlow", 16
    WScript.Quit 1
End If
If Not fso.FolderExists(localRoot) Then fso.CreateFolder localRoot
If Not fso.FolderExists(localDir) Then fso.CreateFolder localDir

If NeedsUpdate(sourceExe, localExe) Then
    pending = localExe & ".pending"
    If fso.FileExists(pending) Then fso.DeleteFile pending, True
    fso.CopyFile sourceExe, pending, True
    If Err.Number <> 0 Then
        shell.Popup "Copying the uploader to the local cache failed." & vbCrLf & Err.Description, 0, "TreasuryFlow", 16
        WScript.Quit 1
    End If
    If fso.FileExists(localExe) Then fso.DeleteFile localExe, True
    fso.MoveFile pending, localExe
End If

shell.Run Chr(34) & localExe & Chr(34) & " " & Chr(34) & sharedHome & Chr(34), 1, False
If Err.Number <> 0 Then
    shell.Popup "Starting TreasuryFlow failed." & vbCrLf & Err.Description, 0, "TreasuryFlow", 16
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
