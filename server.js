// Servidor local del live: sirve la página y conecta el panel de control con el overlay.
// Uso:  node server.js        (sin dependencias, solo Node)
// Overlay:  http://<IP-de-esta-PC>:4800/
// Panel:    http://<IP-de-esta-PC>:4800/control.html
// Emisor:   http://localhost:4800/emisor.html  (en esta PC: comparte las ventanas)
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

let estado = null;            // estado compartido (escena, juego, reto, regalos...)
const oyentes = new Map();    // id -> { res, rol }  (overlays, paneles y el emisor)
let emisorId = null;          // la página que comparte las ventanas (en esta PC)
const vistos = [];            // msgId de TikFinity ya contados (evita duplicados)

function escribir(res, evento, datos) {
  res.write((evento ? "event: " + evento + "\n" : "") + "data: " + JSON.stringify(datos) + "\n\n");
}

function difundir() {
  const datos = { estado, ahora: Date.now() };
  for (const o of oyentes.values()) escribir(o.res, null, datos);
}

function leerCuerpo(req, alTerminar) {
  let cuerpo = "";
  req.on("data", (c) => {
    cuerpo += c;
    if (cuerpo.length > 100000) req.destroy();
  });
  req.on("end", () => {
    try { alTerminar(JSON.parse(cuerpo)); } catch (e) { alTerminar(null); }
  });
}

// Señales WebRTC entre el emisor (esta PC) y los overlays (PC 2)
function enviarSenal(m) {
  const destinos = m.para === "emisor" ? [oyentes.get(emisorId)]
    : m.para === "receptores" ? [...oyentes.values()].filter((o) => o.rol === "receptor")
    : [oyentes.get(m.para)];
  for (const o of destinos) if (o) escribir(o.res, "senal", m);
}

// Eventos de TikFinity reenviados por el overlay: regalos y seguidores
function registrarEvento(ev) {
  const d = ev && ev.data;
  if (!d) return;
  const id = d.msgId || d.eventId;
  if (id) {
    if (vistos.includes(id)) return;
    vistos.push(id);
    if (vistos.length > 500) vistos.shift();
  }
  estado = estado || {};
  const nombre = d.nickname || d.uniqueId || "Alguien";

  if (ev.event === "gift") {
    // Los regalos en racha (rosas, etc.) se cuentan una sola vez cuando termina la racha
    if (d.giftType === 1 && !d.repeatEnd) return;
    const cantidad = d.repeatCount || 1;
    const diamantes = (d.diamondCount || 0) * cantidad;
    const r = estado.regalos = Object.assign({ meta: 1000, diamantes: 0, top: [] }, estado.regalos);
    r.diamantes += diamantes;
    const fila = r.top.find((t) => t.nombre === nombre);
    if (fila) fila.diamantes += diamantes;
    else r.top.push({ nombre, diamantes });
    r.top.sort((a, b) => b.diamantes - a.diamantes);
    r.top = r.top.slice(0, 10);
    r.ultimo = { nombre, regalo: d.giftName || "regalo", cantidad, icono: d.giftPictureUrl || "" };
    estado.alerta = { id: Date.now(), tipo: "regalo", nombre, texto: (d.giftName || "regalo") + " x" + cantidad, icono: d.giftPictureUrl || "", hasta: Date.now() + 5000 };
  } else if (ev.event === "follow") {
    estado.alerta = { id: Date.now(), tipo: "seguidor", nombre, texto: "¡te sigue!", icono: "", hasta: Date.now() + 4000 };
  } else {
    return;
  }
  difundir();
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
    const id = url.searchParams.get("id") || Math.random().toString(36).slice(2);
    const rol = url.searchParams.get("rol") || "panel";
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("retry: 2000\n\n");
    escribir(res, null, { estado, ahora: Date.now() });
    oyentes.set(id, { res, rol });
    if (rol === "emisor") emisorId = id;
    req.on("close", () => {
      if (oyentes.get(id)?.res !== res) return;
      oyentes.delete(id);
      if (rol === "receptor") enviarSenal({ de: id, para: "emisor", tipo: "adios" });
      if (id === emisorId) emisorId = null;
    });
    return;
  }

  if (url.pathname === "/api/estado" && req.method === "POST") {
    leerCuerpo(req, (cambios) => {
      if (!cambios) { res.writeHead(400).end(); return; }
      estado = Object.assign(estado || {}, cambios);
      difundir();
      res.writeHead(204).end();
    });
    return;
  }

  if (url.pathname === "/api/senal" && req.method === "POST") {
    leerCuerpo(req, (m) => {
      if (m) enviarSenal(m);
      res.writeHead(204).end();
    });
    return;
  }

  if (url.pathname === "/api/evento" && req.method === "POST") {
    leerCuerpo(req, (ev) => {
      registrarEvento(ev);
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
setInterval(() => { for (const o of oyentes.values()) o.res.write(": ping\n\n"); }, 20000);

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
  console.log("  Emisor (abrir en ESTA PC):  http://localhost:" + PUERTO + "/emisor.html");
});
