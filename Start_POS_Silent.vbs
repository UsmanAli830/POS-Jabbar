' POS System - Silent Auto-Start Launcher
' Launched by Windows Task Scheduler at user logon.
' Uses WScript.ScriptFullName to get the correct absolute folder path
' regardless of what working directory Task Scheduler sets at runtime.

Dim sScriptDir, sBatPath, sCmd
sScriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sBatPath   = sScriptDir & "Start_POS.bat"
sCmd       = "cmd /c """ & sBatPath & """ /silent"

Dim oShell
Set oShell = CreateObject("WScript.Shell")
oShell.Run sCmd, 0, False
Set oShell = Nothing
