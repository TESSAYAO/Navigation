# 本地服务器文件

这个文件夹包含用于本地开发的服务器脚本。这些文件仅用于本地开发，不会影响GitHub Pages部署。

## 文件说明

- `start_server.bat` - Windows批处理文件，启动Caddy服务器
- `start_server.ps1` - PowerShell脚本，提供多种服务器选项
- `Start-Here.cmd` - 简化的启动脚本
- `server/` - 包含Caddy服务器文件

## 使用方法

如果您需要在本地运行，请：

1. 双击 `start_server.bat` 或
2. 运行 `Start-Here.cmd` 或
3. 使用PowerShell运行 `start_server.ps1`

建议直接使用Python或Node.js的静态服务器，如README.md主页所述。
