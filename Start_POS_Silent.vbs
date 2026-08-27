Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c """ & WshShell.CurrentDirectory & "\Start_POS.bat""", 0, False
