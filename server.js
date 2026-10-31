// Servidor local del live: sirve la página y conecta el panel de control con el overlay.
// Uso:  node server.js        (sin dependencias, solo Node)
// Overlay:  http://<IP-de-esta-PC>:4800/
// Panel:    http://<IP-de-esta-PC>:4800/control.html
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PUERTO = Number(process.env.PORT) || 4800;
const RAIZ = __dirname;
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

let estado = null;            // último estado enviado por el panel
const oyentes = new Set();    // conexiones abiertas (overlays y paneles)

function difundir() {
  const datos = "data: " + JSON.stringify({ estado, ahora: Date.now() }) + "\n\n";
  for (const res of oyentes) res.write(datos);
}

function servirArchivo(req, res) {
  let ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (ruta.endsWith("/")) ruta += "index.html";
  const archivo = path.join(RAIZ, path.normalize(ruta));
  if (!archivo.startsWith(RAIZ) || archivo.includes(`${path.sep}.`)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(archivo, (err, contenido) => {
    if (err) { res.writeHead(404).end("No encontrado"); return; }
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Robots-Tag": "noindex, nofollow",
    });
    res.end(contenido);
  });
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");

  if (url.pathname === "/api/eventos") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("retry: 2000\n\n");
    res.write("data: " + JSON.stringify({ estado, ahora: Date.now() }) + "\n\n");
    oyentes.add(res);
    req.on("close", () => oyentes.delete(res));
    return;
  }

  if (url.pathname === "/api/estado" && req.method === "POST") {
    let cuerpo = "";
    req.on("data", (c) => {
      cuerpo += c;
      if (cuerpo.length > 10000) req.destroy();
    });
    req.on("end", () => {
      try {
        estado = JSON.parse(cuerpo);
      } catch (e) {
        res.writeHead(400).end();
        return;
      }
      difundir();
      res.writeHead(204).end();
    });
    return;
  }

  if (url.pathname === "/api/estado") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ estado, ahora: Date.now() }));
    return;
  }

  servirArchivo(req, res);
});

// Mantiene vivas las conexiones (algunos routers cortan las que están quietas)
setInterval(() => { for (const res of oyentes) res.write(": ping\n\n"); }, 20000);

servidor.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log("El puerto " + PUERTO + " ya está en uso.");
    console.log("Probablemente Vexlow Live ya está abierto en otra ventana: cerrala y volvé a abrir este.");
    process.exit(1);
  }
  throw err;
});

servidor.listen(PUERTO, "0.0.0.0", () => {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
  console.log("Vexlow Live listo:");
  console.log("  Esta PC:  http://localhost:" + PUERTO + "/");
  for (const ip of ips) {
    console.log("  Overlay:  http://" + ip + ":" + PUERTO + "/");
    console.log("  Panel:    http://" + ip + ":" + PUERTO + "/control.html");
  }
});
