@echo off
REM 起一个本地静态服务再打开浏览器。
REM 不能双击 index.html 直接开：ES module 在 file:// 下会被浏览器按跨域拦掉。
cd /d "%~dp0"
start "" http://localhost:8777/index.html
python -m http.server 8777
