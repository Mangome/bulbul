@echo off
echo 当前的 git tag 列表：
git tag --sort=-v:refname
echo.
set /p VERSION=请输入版本号（如 0.5.0）:
if "%VERSION%"=="" (
    echo 版本号不能为空
    pause
    exit /b 1
)
git tag -a v%VERSION% -m "更新版本"
git push origin v%VERSION%
pause
