@echo off
echo ======================================
echo Wyrt Database Setup
echo ======================================
echo.

set /p MYSQL_USER="Enter MySQL username (default: root): "
if "%MYSQL_USER%"=="" set MYSQL_USER=root

set /p MYSQL_PASS="Enter MySQL password: "

echo.
echo Creating database and tables...
mysql -u %MYSQL_USER% -p%MYSQL_PASS% < db\create_database.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================
    echo Database setup completed successfully!
    echo ======================================
    echo.
    echo Database: wyrt
    echo.
    echo You can now start the Wyrt server.
) else (
    echo.
    echo ======================================
    echo ERROR: Database setup failed!
    echo ======================================
    echo Please check your MySQL credentials and try again.
)

pause