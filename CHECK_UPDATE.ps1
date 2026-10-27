$ErrorActionPreference = 'Stop'
Write-Host 'Checking server.js...'
node --check .\server.js
Write-Host 'Checking public\app.js...'
node --check .\public\app.js
Write-Host 'Syntax checks passed. Now run: npm.cmd start'
