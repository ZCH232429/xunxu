param(
  [string]$Vision,
  [string]$Pro32k,
  [string]$Pro128k,
  [string]$Lite,
  [switch]$Partial
)
$ErrorActionPreference = 'Stop'
$values = [ordered]@{
  EXPO_PUBLIC_EP_VISION = $Vision
  EXPO_PUBLIC_EP_PRO = $Pro32k
  EXPO_PUBLIC_EP_PRO_128K = $Pro128k
  EXPO_PUBLIC_EP_LITE = $Lite
}
foreach ($name in @($values.Keys)) {
  if (-not $values[$name] -and $Partial) { $values.Remove($name); continue }
  if (-not $values[$name]) { $values[$name] = Read-Host "请输入 $name 对应的模型 ID 或 Endpoint ID" }
  $values[$name] = $values[$name].Trim()
  if ($values[$name] -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{1,199}$') { throw "$name 需要有效的模型 ID 或 Endpoint ID" }
}
$folder = Join-Path $env:APPDATA '循序'
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$target = Join-Path $folder 'ai-routing.json'
if ($Partial -and (Test-Path -LiteralPath $target)) {
  $existing = Get-Content -LiteralPath $target -Raw | ConvertFrom-Json
  foreach ($property in $existing.PSObject.Properties) {
    if (-not $values.Contains($property.Name)) { $values[$property.Name] = $property.Value }
  }
}
$tempFile = Join-Path $folder ('ai-routing-' + [guid]::NewGuid().ToString() + '.tmp')
try {
  [IO.File]::WriteAllText($tempFile, ($values | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $tempFile -Destination $target -Force
} finally {
  if (Test-Path -LiteralPath $tempFile) { Remove-Item -LiteralPath $tempFile }
}
Write-Output '指定路由配置已保存；尚需真实模型调用验证。未修改或显示 API 密钥。'
