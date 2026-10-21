@echo off
echo ========================================================
echo   Building Custom TCP/IP Protocol Stack (Windows MinGW)
echo ========================================================

if not exist bin mkdir bin
if not exist captures mkdir captures

echo Compiling Native Desktop GUI Application (CustomStackGUI.exe)...
gcc -std=gnu99 -Wall -Wextra -Iinclude src\custom_proto.c src\link_udp.c src\pcap_logger.c src\gui_app.c -o CustomStackGUI.exe -mwindows -lcomctl32 -lgdi32 -lws2_32
if errorlevel 1 goto failed
copy /Y CustomStackGUI.exe bin\CustomStackGUI.exe >nul

echo Compiling Console Control Center (test_custom_stack.exe)...
gcc -std=gnu99 -Wall -Wextra -Iinclude src\custom_proto.c src\link_udp.c src\pcap_logger.c src\telemetry_server.c src\test_custom_stack.c -o test_custom_stack.exe -lws2_32
if errorlevel 1 goto failed
copy /Y test_custom_stack.exe bin\test_custom_stack.exe >nul

echo.
echo ========================================================
echo   [BUILD SUCCESS] Binaries Created Successfully!
echo ========================================================
echo.
echo 1. NATIVE DESKTOP GUI APPLICATION:
echo    Double-click: CustomStackGUI.exe
echo    (Opens rich Windows Desktop UI window with live charts and logs)
echo.
echo 2. CONSOLE CONTROL CENTER:
echo    Double-click: test_custom_stack.exe
echo    (Opens interactive terminal menu)
goto end

:failed
echo [BUILD FAILED] Compilation encountered errors.

:end
