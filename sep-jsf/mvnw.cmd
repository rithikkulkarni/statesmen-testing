@REM ----------------------------------------------------------------------------
@REM Maven Wrapper startup script for Windows
@REM Downloads Maven automatically if not already cached.
@REM ----------------------------------------------------------------------------
@echo off
setlocal

set MAVEN_PROJECTBASEDIR=%~dp0
set MAVEN_WRAPPER_PROPERTIES=%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.properties

@REM Read distributionUrl from wrapper properties
for /f "usebackq tokens=1,* delims==" %%A in ("%MAVEN_WRAPPER_PROPERTIES%") do (
    if "%%A"=="distributionUrl" set DISTRIBUTION_URL=%%B
)

@REM Derive cache directory  C:\Users\<name>\.m2\wrapper\dists\apache-maven-x.y.z
for %%F in ("%DISTRIBUTION_URL%") do set DIST_FILENAME=%%~nF
set M2_HOME_WRAPPER=%USERPROFILE%\.m2\wrapper\dists\%DIST_FILENAME%

if not exist "%M2_HOME_WRAPPER%\bin\mvn.cmd" (
    echo Downloading Maven from %DISTRIBUTION_URL% ...
    if not exist "%M2_HOME_WRAPPER%" mkdir "%M2_HOME_WRAPPER%"
    set DOWNLOAD_DEST=%TEMP%\%DIST_FILENAME%.zip
    powershell -Command "Invoke-WebRequest -Uri '%DISTRIBUTION_URL%' -OutFile '%DOWNLOAD_DEST%'"
    if errorlevel 1 (
        echo ERROR: Failed to download Maven. Check your internet connection.
        exit /b 1
    )
    echo Extracting Maven ...
    powershell -Command "Expand-Archive -Force -Path '%DOWNLOAD_DEST%' -DestinationPath '%M2_HOME_WRAPPER%\..'"
    del "%DOWNLOAD_DEST%"
    @REM Move extracted folder into the expected location
    for /d %%D in ("%M2_HOME_WRAPPER%\..\apache-maven-*") do (
        if not "%%D"=="%M2_HOME_WRAPPER%" (
            xcopy /e /q /i "%%D" "%M2_HOME_WRAPPER%" >nul
            rmdir /s /q "%%D"
        )
    )
    echo Maven ready.
)

"%M2_HOME_WRAPPER%\bin\mvn.cmd" %*
