@echo off
rem Bat du an cho DRONE THAT (bay ngoai troi): hotspot laptop -> backend -> web -> trinh duyet.
rem Drone ao (SITL) thi dung chay-tat-ca.bat. Hai file KHONG chay cung luc (cung cong 8000).
rem
rem Truoc khi chay: cam pin drone (GPS, la ban, ESP32 deu lay dien tu pin).
rem Internet ngoai bai: iPhone bat "Diem truy cap ca nhan" roi CAM CAP vao laptop TRUOC khi chay
rem file nay (hotspot laptop chia se ket noi dang co internet; khong co thi hotspot khong bat).
rem KHONG noi Wi-Fi laptop vao dien thoai: card Wi-Fi chi phat hotspot cho hai ESP32. Do 02/11/2026:
rem Wi-Fi laptop noi them mang ngoai -> DroneBridge mat 32 %% goi, camera 1,4 khung/s; chi phat
rem hotspot (internet qua cap iPhone) -> 3 %%, 4,7 khung/s. Hotspot duoc bat lai moi lan chay file
rem nay de chia se dung mang dang co.
rem Truoc do chay scripts\laptop\che_do_bay.ps1 -Bat (khong ngu, Energy Saver khong tu bat, card
rem Wi-Fi khong tu quet nen: moi lan quet hai ESP32 mat goi vai giay).
rem
rem Ghi lai moi chuyen bay, tren laptop (khong can the nho):
rem   logs\recordings\  video camera (.avi) + frames.csv (gio, vi tri drone tung khung)
rem   logs\tlog\        telemetry MAVLink (.tlog, Mission Planner mo duoc)
rem Tat het: dung-tat-ca.bat
setlocal
cd /d "%~dp0"

set "MAVLINK_ENDPOINT=udpin:0.0.0.0:14550"
set "VISION_ENABLED=1"
set "CAMERA_FAKE=0"
set "CAMERA_STREAM_URL=http://iotcv-camera.mshome.net:81/stream"
rem Gioi han cua web, NHO hon geofence tren FC (tran 20 m, ban kinh 100 m tu 15/11/2026)
rem de mission do web gui khong bao gio cham hang rao (cach rao 5 m).
set "MAX_ALT=18"
set "MIN_ALT=2"
set "MAX_DISTANCE_HOME=95"
set "RECORD_VIDEO=1"
set "TLOG_ENABLE=1"
set "WEB_URL=http://localhost:5173"

echo [1/4] Tat backend / web cu (cong 8000, 5173). SITL neu dang chay thi de nguyen...
powershell -NoProfile -Command "foreach ($p in 8000,5173) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"
taskkill /fi "WINDOWTITLE eq IOT-CV Backend*" /t /f >nul 2>nul
taskkill /fi "WINDOWTITLE eq IOT-CV Frontend*" /t /f >nul 2>nul

rem Ba canh bao (chi in ra, khong doi gi tren may): nhung loi da lam hong buoi bay 01/11/2026.
rem Co canh bao thi dung lai cho sua TRUOC khi bat hotspot: hotspot bam vao mang co internet luc no
rem duoc bat; sua sau (ngat Wi-Fi, cam cap iPhone) thi 20 phut sau Windows tu tat hotspot (02/11/2026).
set "CANH_BAO="
echo      Kiem tra laptop truoc khi bat hotspot...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\laptop\che_do_bay.ps1" | findstr /c:"CHUA o che do bay"
if not errorlevel 1 (
  echo   CANH BAO: laptop CHUA o che do bay ^(dong tren^) - chay pin se tu ngu sau 10 phut, gap nap
  echo             la ngu, Energy Saver tu bat, card Wi-Fi tu quet. Chay: scripts\laptop\che_do_bay.ps1 -Bat
  set "CANH_BAO=1"
)
powershell -NoProfile -Command "if (Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.InterfaceDescription -match 'Apple Mobile Device Ethernet' -and $_.Status -eq 'Up' }) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo   CANH BAO: chua thay mang iPhone qua cap. Bat Diem truy cap ca nhan, cam cap, bam Tin cay.
  set "CANH_BAO=1"
)
powershell -NoProfile -Command "$w = @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object { $_.NdisPhysicalMedium -eq 9 }); if ($w | Where-Object { Get-NetConnectionProfile -InterfaceIndex $_.ifIndex -ErrorAction SilentlyContinue }) { exit 1 } else { exit 0 }"
if errorlevel 1 (
  echo   CANH BAO: Wi-Fi laptop dang noi mot mang khac - card phai chia song, hai ESP32 mat goi.
  echo             Ngat mang Wi-Fi do ra; internet lay qua cap iPhone.
  set "CANH_BAO=1"
)
if defined CANH_BAO (
  echo.
  echo   Sua xong roi bam phim bat ky de chay tiep. Chap nhan nhu vay thi bam luon.
  pause >nul
)

echo [2/4] Bat lai hotspot laptop cho hai ESP32 (IOTCV-HOTSPOT, 2,4 GHz)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\esp32\hotspot-on.ps1" -Restart
if errorlevel 1 (
  echo CANH BAO: khong bat duoc hotspot. Bat tay: Settings ^> Network ^> Mobile hotspot.
)

echo [3/4] Backend (cua so rieng, nghe MAVLink UDP 14550 tu ESP32 DroneBridge)...
start "IOT-CV Backend" /min cmd /k "uv run uvicorn backend.app:app --host 127.0.0.1 --port 8000"

echo [4/4] Web (cua so rieng)...
start "IOT-CV Frontend" /min /d "%~dp0frontend" cmd /k pnpm dev

echo Doi backend nhan duoc flight controller (toi da 60 s)...
set /a TRIES=0
:wait
set /a TRIES+=1
powershell -NoProfile -Command "Start-Sleep 2"
powershell -NoProfile -Command "try { $s = Invoke-RestMethod http://127.0.0.1:8000/api/system -TimeoutSec 2; if ($s.link_alive) { exit 0 } else { exit 1 } } catch { exit 1 }"
if not errorlevel 1 goto ready
if %TRIES% geq 30 goto nolink
goto wait

:nolink
echo.
echo CANH BAO: sau 60 s backend van chua nhan duoc flight controller. Kiem tra:
echo   - Pin drone da cam chua (ESP32 DroneBridge lay dien tu pin).
echo   - ESP32 da noi hotspot chua: py -3.13 scripts\esp32\wifi_ping_check.py
echo   - Mission Planner co dang nghe UDP 14550 khong (dong no lai roi chay lai file nay).
echo   Web van mo; backend tu noi lai khi co tin hieu.
goto open

:ready
echo OK: backend da nhan flight controller qua Wi-Fi.

:open
start "" "%WEB_URL%"
echo.
echo   Backend  http://127.0.0.1:8000   (MAVLink udpin:0.0.0.0:14550)
echo   Web      %WEB_URL%
echo   Camera   %CAMERA_STREAM_URL%
echo   Video    %~dp0logs\recordings\   (den REC tren panel Video)
echo   Tlog     %~dp0logs\tlog\
echo.
echo   Mission Planner va backend KHONG nghe chung cong UDP 14550: muon dung
echo   Mission Planner qua Wi-Fi thi dung-tat-ca.bat truoc.
echo   Tat het: dung-tat-ca.bat
echo.
pause
