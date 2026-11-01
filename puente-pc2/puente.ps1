# Puente para la PC del live (PC 2).
# TikTok LIVE Studio no acepta direcciones IP en la fuente "Enlace", pero sí
# http://localhost. Este puente atiende en http://localhost:4800/ de la PC 2 y
# reenvía todo a la PC del juego (PC 1), donde corre server.js.
# Solo usa PowerShell, que ya viene con Windows.
param(
  [string]$Pc1 = "",
  [int]$Puerto = 4800
)

$ErrorActionPreference = "Stop"
$carpeta = Split-Path -Parent $MyInvocation.MyCommand.Path
$archivoIp = Join-Path $carpeta "ip-pc1.txt"

if (-not $Pc1) {
  if (Test-Path $archivoIp) { $Pc1 = (Get-Content $archivoIp -TotalCount 1).Trim() }
}
if (-not $Pc1) {
  $Pc1 = Read-Host "IP de la PC del juego (la que muestra iniciar-live.bat, ej. 192.168.1.69)"
  Set-Content -Path $archivoIp -Value $Pc1 -Encoding ascii
}
$destino = "http://" + $Pc1 + ":4800"

# Probamos que la PC 1 responda antes de arrancar
try {
  Invoke-WebRequest -Uri ($destino + "/api/estado") -UseBasicParsing -TimeoutSec 5 | Out-Null
} catch {
  Write-Host ""
  Write-Host "No responde $destino" -ForegroundColor Red
  Write-Host "- ¿Está abierto iniciar-live.bat en la PC del juego?"
  Write-Host "- ¿La IP es correcta? Para cambiarla, borrá ip-pc1.txt y abrí este puente de nuevo."
  exit 1
}

$escucha = New-Object System.Net.HttpListener
$escucha.Prefixes.Add("http://localhost:" + $Puerto + "/")
$escucha.Prefixes.Add("http://127.0.0.1:" + $Puerto + "/")
try { $escucha.Start() } catch {
  Write-Host "El puerto $Puerto ya está en uso en esta PC. ¿El puente ya está abierto en otra ventana?" -ForegroundColor Red
  exit 1
}

# Cada pedido se atiende en su propio hilo: las conexiones en vivo (SSE)
# quedan abiertas mucho tiempo y no deben frenar a las demás.
$atender = {
  param($ctx, $destino)
  $req = $ctx.Request
  $res = $ctx.Response
  $r = $null
  try {
    $w = [System.Net.HttpWebRequest]::Create($destino + $req.RawUrl)
    $w.Method = $req.HttpMethod
    $w.AllowReadStreamBuffering = $false
    $w.Timeout = [System.Threading.Timeout]::Infinite
    $w.ReadWriteTimeout = [System.Threading.Timeout]::Infinite
    if ($req.ContentType) { $w.ContentType = $req.ContentType }
    if ($req.HasEntityBody) {
      $cuerpo = New-Object System.IO.MemoryStream
      $req.InputStream.CopyTo($cuerpo)
      $w.ContentLength = $cuerpo.Length
      $s = $w.GetRequestStream()
      $cuerpo.Position = 0
      $cuerpo.CopyTo($s)
      $s.Close()
    }
    try { $r = $w.GetResponse() } catch [System.Net.WebException] { $r = $_.Exception.Response; if (-not $r) { throw } }

    $res.StatusCode = [int]$r.StatusCode
    if ($r.ContentType) { $res.ContentType = $r.ContentType }
    $res.Headers.Add("Cache-Control", "no-cache")
    $res.SendChunked = $true
    $entrada = $r.GetResponseStream()
    $buf = New-Object byte[] 16384
    while (($n = $entrada.Read($buf, 0, $buf.Length)) -gt 0) {
      $res.OutputStream.Write($buf, 0, $n)
      $res.OutputStream.Flush()
    }
  } catch {
    try { $res.StatusCode = 502 } catch {}
  } finally {
    # Cerrar también la conexión con la PC 1: así se entera de que el overlay se fue
    if ($r) { try { $r.Close() } catch {} }
    try { $res.OutputStream.Close() } catch {}
  }
}

$pool = [RunspaceFactory]::CreateRunspacePool(1, 64)
$pool.Open()

Write-Host ""
Write-Host "Puente Vexlow Live listo" -ForegroundColor Green
Write-Host "  PC del juego:  $destino"
Write-Host "  En TikTok LIVE Studio usá el enlace:  http://localhost:$Puerto/" -ForegroundColor Cyan
Write-Host ""
Write-Host "No cierres esta ventana durante el live."

$trabajos = New-Object System.Collections.ArrayList
while ($escucha.IsListening) {
  $ctx = $escucha.GetContext()
  $ps = [PowerShell]::Create()
  $ps.RunspacePool = $pool
  [void]$ps.AddScript($atender).AddArgument($ctx).AddArgument($destino)
  [void]$trabajos.Add(@{ ps = $ps; h = $ps.BeginInvoke() })
  # Limpia los hilos que ya terminaron
  for ($i = $trabajos.Count - 1; $i -ge 0; $i--) {
    if ($trabajos[$i].h.IsCompleted) {
      $trabajos[$i].ps.Dispose()
      $trabajos.RemoveAt($i)
    }
  }
}
