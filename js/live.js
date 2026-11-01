(function () {
  "use strict";

  var cfg = window.LIVE_CONFIG;
  var C = window.VexlowConexion;
  var R = window.VexlowReceptor;
  var ESCENAS = ["inicio", "juego", "pausa", "cierre"];
  var params = new URLSearchParams(location.search);

  var estado = {
    escena: "inicio",
    juego: 0,
    finCuenta: 0,
    cinta: params.get("cinta") !== "no",
    anuncio: null,
  };
  var conectado = false;
  var remoto = {};   // lo que manda el panel: reto, muertes, regalos, gancho, título...

  // ---------- Guardado local (para que un F5 no te cambie la escena) ----------
  function guardar() {
    try { localStorage.setItem("vexlow-live", JSON.stringify(estado)); } catch (e) {}
  }
  function cargar() {
    try {
      var g = JSON.parse(localStorage.getItem("vexlow-live"));
      if (g) Object.assign(estado, g);
    } catch (e) {}
  }

  // ---------- Escala del lienzo 1080x1920 ----------
  var escenario = document.getElementById("escenario");
  function ajustar() {
    var s = Math.min(innerWidth / 1080, innerHeight / 1920);
    escenario.style.transform = "translate(-50%, -50%) scale(" + s + ")";
  }

  // ---------- Fondo ----------
  // OBS -> transparente sola; ?fondo=verde para chroma key; ?fondo=negro para forzar
  var fondo = params.get("fondo") || (window.obsstudio ? "transparente" : "negro");
  document.body.classList.add("fondo-" + fondo);

  // ---------- Textos de la config ----------
  function rellenar(sel, fn) {
    document.querySelectorAll(sel).forEach(fn);
  }
  rellenar("[data-marca]", function (el) { el.textContent = cfg.marca; });
  rellenar("[data-subtitulo]", function (el) { el.textContent = cfg.subtitulo; });
  if (cfg.tiktok) {
    rellenar("[data-seguinos]", function (el) { el.textContent = "Seguinos en TikTok: " + cfg.tiktok; });
  }
  rellenar("[data-fila-juegos]", function (el) {
    cfg.juegos.forEach(function (j) {
      var img = document.createElement("img");
      img.src = j.icono;
      img.alt = j.nombre;
      el.appendChild(img);
    });
  });
  rellenar("[data-vitrina]", function (el) {
    cfg.juegos.forEach(function (j) {
      var item = document.createElement("div");
      item.className = "item";
      item.innerHTML = '<img alt=""><div><strong></strong><span></span></div>';
      item.querySelector("img").src = j.icono;
      item.querySelector("strong").textContent = j.nombre;
      item.querySelector("span").textContent = j.donde || j.frase;
      el.appendChild(item);
    });
  });

  // ---------- Escenas ----------
  function mostrarEscena(nombre) {
    if (ESCENAS.indexOf(nombre) < 0) return;
    estado.escena = nombre;
    document.querySelectorAll(".escena").forEach(function (el) {
      el.classList.toggle("activa", el.dataset.escena === nombre);
    });
    escenario.dataset.escena = nombre;
    R.activar(nombre === "juego");
    guardar();
  }

  function mostrarJuego(i) {
    var n = cfg.juegos.length;
    estado.juego = ((i % n) + n) % n;
    var j = cfg.juegos[estado.juego];
    rellenar("[data-juego-icono]", function (el) { el.src = j.icono; });
    rellenar("[data-juego-nombre]", function (el) { el.textContent = j.nombre; });
    rellenar("[data-juego-frase]", function (el) { el.textContent = j.frase; });
    rellenar("[data-juego-donde]", function (el) { el.textContent = j.donde || ""; });
    pintarTitulo();
    guardar();
  }

  // ---------- Cuenta regresiva ----------
  var cuentaEl = document.getElementById("cuenta");
  function reiniciarCuenta(min) {
    estado.finCuenta = C.ahora() + min * 60000;
    guardar();
    tic();
  }
  function tic() {
    var resto = Math.max(0, Math.ceil((estado.finCuenta - C.ahora()) / 1000));
    if (resto === 0) {
      cuentaEl.textContent = "¡YA!";
      cuentaEl.classList.add("ya");
    } else {
      var m = Math.floor(resto / 60), s = resto % 60;
      cuentaEl.textContent = (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
      cuentaEl.classList.remove("ya");
    }
  }

  // ---------- Cinta de mensajes ----------
  var cintaEl = document.getElementById("cinta");
  var mensajeEl = document.getElementById("cinta-mensaje");
  var iMsg = 0;
  function siguienteMensaje() {
    if (!cfg.cinta.length) return;
    mensajeEl.textContent = cfg.cinta[iMsg++ % cfg.cinta.length];
    mensajeEl.classList.remove("cambia"); void mensajeEl.offsetWidth;
    mensajeEl.classList.add("cambia");
  }
  function aplicarCinta() {
    cintaEl.classList.toggle("oculta", !estado.cinta);
    guardar();
  }

  // ---------- Anuncio (texto grande que manda el panel) ----------
  var anuncioEl = document.getElementById("anuncio");
  var anuncioTexto = document.getElementById("anuncio-texto");
  function revisarAnuncio() {
    var a = estado.anuncio;
    var visible = !!(a && a.texto && C.ahora() < a.hasta);
    if (visible && anuncioTexto.textContent !== a.texto) anuncioTexto.textContent = a.texto;
    anuncioEl.classList.toggle("activo", visible);
  }

  // ---------- Escena de juego: gancho, reto, muertes y regalos ----------
  var ganchoEl = document.getElementById("gancho-texto");
  var iGancho = 0;
  function siguienteGancho() {
    var lista = remoto.gancho ? [remoto.gancho] : (cfg.ganchos || []);
    if (!lista.length) return;
    var texto = lista[iGancho++ % lista.length];
    if (ganchoEl.textContent === texto) return;
    ganchoEl.textContent = texto;
    ganchoEl.classList.remove("cambia"); void ganchoEl.offsetWidth;
    ganchoEl.classList.add("cambia");
  }

  function pintarTitulo() {
    document.getElementById("titulo-juego").textContent = remoto.titulo || cfg.tituloJuego || "";
  }

  var muertesEl = document.getElementById("muertes");
  function pintarWidgets() {
    pintarTitulo();
    var reto = remoto.reto || {};
    document.getElementById("reto-texto").textContent = reto.texto || cfg.reto || "";
    document.querySelector(".tarjeta-reto").classList.toggle("hecho", !!reto.hecho);

    var m = String(remoto.muertes || 0);
    if (muertesEl.textContent !== m) {
      muertesEl.textContent = m;
      muertesEl.classList.remove("sube"); void muertesEl.offsetWidth;
      muertesEl.classList.add("sube");
    }

    var r = remoto.regalos || {};
    var meta = r.meta || cfg.metaRegalos || 1000;
    var dia = r.diamantes || 0;
    document.getElementById("meta-relleno").style.width = Math.min(100, dia / meta * 100) + "%";
    document.getElementById("meta-texto").textContent = dia + " / " + meta + " 💎";

    var ult = document.getElementById("ultimo-regalo");
    if (r.ultimo) {
      ult.innerHTML = '<img alt=""><span>Último: <b></b> · </span>';
      var img = ult.querySelector("img");
      if (r.ultimo.icono) img.src = r.ultimo.icono; else img.remove();
      ult.querySelector("b").textContent = r.ultimo.nombre;
      ult.querySelector("span").append(r.ultimo.regalo + " x" + r.ultimo.cantidad);
    }
    var top = document.getElementById("top-regalos");
    top.textContent = "";
    (r.top || []).slice(0, 3).forEach(function (t) {
      var li = document.createElement("li");
      li.textContent = t.nombre;
      top.appendChild(li);
    });
  }

  // Alerta de regalo o seguidor
  var alertaEl = document.getElementById("alerta");
  var alertaVista = null;
  function revisarAlerta() {
    var a = remoto.alerta;
    var visible = !!(a && C.ahora() < a.hasta);
    if (visible && a.id !== alertaVista) {
      alertaVista = a.id;
      alertaEl.classList.toggle("seguidor", a.tipo === "seguidor");
      document.getElementById("alerta-icono").src = a.icono || "";
      document.getElementById("alerta-nombre").textContent = a.nombre;
      document.getElementById("alerta-texto").textContent = a.texto;
    }
    alertaEl.classList.toggle("activa", visible);
  }

  // ---------- TikFinity (regalos y seguidores reales) ----------
  // La app de escritorio de TikFinity, abierta en la PC del live, publica los
  // eventos en ws://localhost:21213/. Los pasamos al servidor, que los suma.
  function conectarTikFinity() {
    var ws;
    try { ws = new WebSocket(params.get("tikfinity") || "ws://localhost:21213/"); }
    catch (e) { setTimeout(conectarTikFinity, 5000); return; }
    ws.onmessage = function (e) {
      var d;
      try { d = JSON.parse(e.data); } catch (err) { return; }
      if (conectado && d && (d.event === "gift" || d.event === "follow")) C.evento(d);
    };
    ws.onclose = function () { setTimeout(conectarTikFinity, 5000); };
  }

  // ---------- Panel de control remoto ----------
  function aplicarRemoto(nuevo) {
    // El servidor recién arrancó y no tiene estado: le pasamos el nuestro
    if (!nuevo) { conectado = true; avisarPanel(); return; }
    if (nuevo.juego !== estado.juego && typeof nuevo.juego === "number") mostrarJuego(nuevo.juego);
    if (nuevo.escena !== estado.escena) mostrarEscena(nuevo.escena);
    if (typeof nuevo.finCuenta === "number") { estado.finCuenta = nuevo.finCuenta; tic(); }
    if (typeof nuevo.cinta === "boolean" && nuevo.cinta !== estado.cinta) { estado.cinta = nuevo.cinta; aplicarCinta(); }
    estado.anuncio = nuevo.anuncio || null;
    remoto = nuevo;
    R.ajustes(nuevo.fuentes);
    R.volumen(nuevo.volumen);
    guardar();
    revisarAnuncio();
    pintarWidgets();
    revisarAlerta();
    if (nuevo.gancho !== ganchoFijo) { ganchoFijo = nuevo.gancho; iGancho = 0; siguienteGancho(); }
  }
  var ganchoFijo;
  function avisarPanel() {
    if (conectado) C.enviar(estado);
  }

  // ---------- Teclado ----------
  var ayuda = document.getElementById("ayuda");
  document.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k >= "1" && k <= "4") mostrarEscena(ESCENAS[+k - 1]);
    else if (k === "ArrowRight") mostrarJuego(estado.juego + 1);
    else if (k === "ArrowLeft") mostrarJuego(estado.juego - 1);
    else if (k === "r" || k === "R") reiniciarCuenta(cfg.cuentaMinutos);
    else if (k === "+") { estado.finCuenta = Math.max(estado.finCuenta, C.ahora()) + 60000; guardar(); tic(); }
    else if (k === "-") { estado.finCuenta = Math.max(C.ahora(), estado.finCuenta - 60000); guardar(); tic(); }
    else if (k === "t" || k === "T") { estado.cinta = !estado.cinta; aplicarCinta(); }
    else if (k === "h" || k === "H" || k === "?") ayuda.hidden = !ayuda.hidden;
    else return;
    e.preventDefault();
    avisarPanel();
  });

  // ---------- Arranque ----------
  cargar();
  // Los parámetros de la URL mandan sobre lo guardado
  if (params.get("escena")) estado.escena = params.get("escena");
  if (params.get("juego")) {
    var buscado = params.get("juego").toLowerCase();
    var idx = cfg.juegos.findIndex(function (j) { return j.nombre.toLowerCase().indexOf(buscado) >= 0; });
    if (idx >= 0) estado.juego = idx;
  }
  if (params.get("cuenta")) reiniciarCuenta(parseFloat(params.get("cuenta")) || cfg.cuentaMinutos);
  else if (!estado.finCuenta) reiniciarCuenta(cfg.cuentaMinutos);
  if (params.has("ayuda")) ayuda.hidden = false;

  ajustar();
  addEventListener("resize", ajustar);
  mostrarJuego(estado.juego);
  mostrarEscena(estado.escena);
  aplicarCinta();
  siguienteMensaje();
  setInterval(siguienteMensaje, 6000);
  pintarWidgets();
  siguienteGancho();
  setInterval(siguienteGancho, 5000);
  setInterval(function () { tic(); revisarAnuncio(); revisarAlerta(); }, 250);
  C.escuchar(aplicarRemoto, function (ok) {
    conectado = !!ok;
    if (ok) R.pedirImagen();
  }, "receptor");
  conectarTikFinity();
})();
