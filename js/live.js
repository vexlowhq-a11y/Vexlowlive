(function () {
  "use strict";

  var cfg = window.LIVE_CONFIG;
  var ESCENAS = ["inicio", "juego", "pausa", "cierre"];
  var params = new URLSearchParams(location.search);

  var estado = {
    escena: "inicio",
    juego: 0,
    finCuenta: 0,
    cinta: params.get("cinta") !== "no",
  };

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
    // reinicia la animación de entrada de la tarjeta
    var t = document.querySelector(".tarjeta-juego");
    t.style.animation = "none"; void t.offsetWidth; t.style.animation = "";
    guardar();
  }

  // ---------- Cuenta regresiva ----------
  var cuentaEl = document.getElementById("cuenta");
  function reiniciarCuenta(min) {
    estado.finCuenta = Date.now() + min * 60000;
    guardar();
    tic();
  }
  function tic() {
    var resto = Math.max(0, Math.ceil((estado.finCuenta - Date.now()) / 1000));
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

  // ---------- Teclado ----------
  var ayuda = document.getElementById("ayuda");
  document.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k >= "1" && k <= "4") mostrarEscena(ESCENAS[+k - 1]);
    else if (k === "ArrowRight") mostrarJuego(estado.juego + 1);
    else if (k === "ArrowLeft") mostrarJuego(estado.juego - 1);
    else if (k === "r" || k === "R") reiniciarCuenta(cfg.cuentaMinutos);
    else if (k === "+") { estado.finCuenta = Math.max(estado.finCuenta, Date.now()) + 60000; guardar(); tic(); }
    else if (k === "-") { estado.finCuenta = Math.max(Date.now(), estado.finCuenta - 60000); guardar(); tic(); }
    else if (k === "t" || k === "T") { estado.cinta = !estado.cinta; aplicarCinta(); }
    else if (k === "h" || k === "H" || k === "?") ayuda.hidden = !ayuda.hidden;
    else return;
    e.preventDefault();
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
  setInterval(tic, 250);
})();
