@echo off
setlocal enabledelayedexpansion

set "drop_tables=false"
if /i "%1"=="--drop-tables" set "drop_tables=true"
if /i "%1"=="-d" set "drop_tables=true"
if /i "%1"=="/drop" set "drop_tables=true"

echo Starting SQL file execution...
if "!drop_tables!"=="true" (
    echo Mode: DROP TABLES FIRST
) else (
    echo Mode: NORMAL EXECUTION
)

if not exist "SQL" (
    echo Error: SQL folder not found!
    pause
    exit /b 1
)

if not exist "config\server.json" (
    echo Error: config\server.json not found!
    pause
    exit /b 1
)

set "port=3306"

for /f "tokens=2 delims=:, " %%a in ('findstr /A /C:"host" config\server.json') do (
    set "host=%%~a"
    set "host=!host:"=!"
    set "host=!host: =!"
)

for /f "tokens=2 delims=:, " %%a in ('findstr /A /C:"user" config\server.json') do (
    set "username=%%~a"
    set "username=!username:"=!"
    set "username=!username: =!"
)

for /f "tokens=2 delims=:, " %%a in ('findstr /A /C:"password" config\server.json') do (
    set "password=%%~a"
    set "password=!password:"=!"
    set "password=!password: =!"
)

for /f "tokens=2 delims=:, " %%a in ('findstr /A /C:"database" config\server.json') do (
    set "database=%%~a"
    set "database=!database:"=!"
    set "database=!database: =!"
)

echo Configuration loaded:
echo Host: !host!
echo Port: !port!
echo Username: !username!
echo Password: ****
echo Database: !database!
echo.

mariadb --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: MariaDB client not found in PATH!
    echo Please ensure MariaDB is installed and mariadb.exe is in your PATH.
    pause
    exit /b 1
)

set /a success_count=0
set /a error_count=0
set /a total_count=0

if "!drop_tables!"=="true" (
    echo.
    echo WARNING: You have chosen to drop all tables first!
    echo This will permanently delete all data in the database.
    set /p confirm="Are you sure you want to continue? (y/N): "
    
    if /i "!confirm!" neq "y" (
        echo Operation cancelled by user.
        pause
        exit /b 0
    )
    
    echo.
    echo Retrieving table list...

    mariadb -h !host! -P !port! -u !username! -p!password! !database! -e "SHOW TABLES;" -s -N > temp_tables.txt 2>nul
    
    if exist temp_tables.txt (
        for /f %%t in (temp_tables.txt) do (
            echo Dropping table: %%t
            mariadb -h !host! -P !port! -u !username! -p!password! !database! -e "DROP TABLE IF EXISTS %%t;"
            
            if !errorlevel! equ 0 (
                echo [SUCCESS] Table %%t dropped
            ) else (
                echo [ERROR] Failed to drop table %%t
            )
        )
        del temp_tables.txt
    ) else (
        echo No tables found or unable to retrieve table list.
    )
    
    echo.
    echo Table dropping completed.
    echo ================================
)

echo Executing SQL files...
echo ================================

for %%f in (SQL\*.sql) do (
    set /a total_count+=1
    echo Processing: %%f

    mariadb -h !host! -P !port! -u !username! -p!password! !database! < "%%f"

    if !errorlevel! equ 0 (
        echo [SUCCESS] %%f executed successfully
        set /a success_count+=1
    ) else (
        echo [ERROR] Failed to execute %%f
        set /a error_count+=1
    )
    echo.
)

echo ================================
echo Execution Summary:
echo Total files processed: !total_count!
echo Successfully executed: !success_count!
echo Failed executions: !error_count!

if !error_count! gtr 0 (
    echo.
    echo Warning: Some SQL files failed to execute. Please check the output above for details.
    exit /b 1
) else (
    echo.
    echo All SQL files executed successfully!
)

echo.
echo Usage: %~nx0 [--drop-tables | -d | /drop]
echo   --drop-tables, -d, /drop : Drop all tables before executing SQL files

pause
