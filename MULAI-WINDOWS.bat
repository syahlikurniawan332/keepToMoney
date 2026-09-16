@echo off
setlocal
cd /d "%~dp0"
echo Arus Modern - menyiapkan aplikasi...
if not exist ".venv\Scripts\python.exe" (
  py -3 -m venv .venv
  if errorlevel 1 goto failed
)
if not exist ".venv\arus-installed.txt" (
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
  if errorlevel 1 goto failed
  type nul > ".venv\arus-installed.txt"
)
echo.
echo Buka http://127.0.0.1:8765 setelah server aktif.
echo Jangan tutup jendela ini selama aplikasi dipakai.
echo.
".venv\Scripts\python.exe" run.py
pause
exit /b
:failed
echo.
echo Gagal menyiapkan aplikasi. Pastikan Python 3.10+ terpasang dan internet aktif.
echo Lihat pesan kesalahan di atas. Panduan ada di MULAI-DI-SINI.html.
pause
exit /b 1
