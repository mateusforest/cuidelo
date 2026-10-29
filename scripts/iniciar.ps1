$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$runtimeDir = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$bundledNode = Join-Path $runtimeDir 'bin/node.exe'
if ($nodeCommand) { $nodePath = $nodeCommand.Source }
elseif (Test-Path -LiteralPath $bundledNode) { $nodePath = $bundledNode }
else { throw 'Instale Node.js 22.12 ou superior e pnpm 11.25.0 para iniciar o Cuidelo.' }
$env:PATH = (Split-Path -Parent $nodePath) + ';' + $env:PATH
$nodeMajor = [int]((& $nodePath --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 22) { throw 'O Cuidelo requer Node.js 22.12 ou superior.' }
if ($nodeMajor -ge 24) { $env:NODE_USE_SYSTEM_CA = '1' }
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
$pnpmBundled = Join-Path $runtimeDir 'node_modules/pnpm/bin/pnpm.cjs'
if (-not (Test-Path -LiteralPath 'node_modules/vite/bin/vite.js')) {
    Write-Host 'Preparando os arquivos para a primeira abertura...'
    if ($pnpmCommand) { & $pnpmCommand.Source install --frozen-lockfile }
    elseif (Test-Path -LiteralPath $pnpmBundled) { & $nodePath $pnpmBundled install --frozen-lockfile }
    else { throw 'Instale pnpm 11.25.0 para preparar as dependencias.' }
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel preparar as dependencias. Confira a conexao e a mensagem acima.' }
}
Write-Host 'Cuidelo - ambiente local com dados ficticios.'
Write-Host 'Abra http://127.0.0.1:4173/ e mantenha esta janela aberta durante o uso.'
& $nodePath 'node_modules/vite/bin/vite.js' --open
exit $LASTEXITCODE
