@echo off
echo ========================================================
echo   Starting MongoDB Instance for Student Early Alert System
echo ========================================================

set MONGO_PATH="C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe"
if not exist %MONGO_PATH% (
    set MONGO_PATH="C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe"
)
if not exist %MONGO_PATH% (
    set MONGO_PATH="C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe"
)

if not exist "data\db" (
    echo Creating local database directory: data\db ...
    mkdir "data\db"
)

echo Starting mongod on port 27017...
%MONGO_PATH% --dbpath "data\db" --port 27017

pause
