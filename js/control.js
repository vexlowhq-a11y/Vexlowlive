(function () {
  "use strict";

  var cfg = window.LIVE_CONFIG;
  var C = window.VexlowConexion;
  var SEGUNDOS_ANUNCIO = 8;

  // Estado compartido con el overlay (llega del servidor)
  var estado = null;

  var estadoEl = document.getElementById("estado-conexion");
  var cuentaEl = document.getElementById("cuenta");
  var cintaEl = document.getElementById("cinta");
  var textoAnuncio = document.getElementById("anuncio-texto");

  function marcarConexion(ok) {
    estadoEl.className = "estado " + (ok ? "ok" : "error");
    estadoEl.textContent = ok ? "Conectado" : ok === null ? "Abrí con node server.js" : "Sin conexión";
  }

  function cambiar(cambios) {
    if (!estado) return;
    Object.assign(estado, cambios);
    pintar();
    C.enviar(estado).catch(function () { marcarConexion(false); });
  }

  // ---------- Botones ----------
  document.querySelectorAll("[data-escena]").forEach(function (b) {
    b.addEventListener("click", function () { cambiar({ escena: b.dataset.escena }); });
  });

  var juegosEl = document.getElementById("juegos");
  cfg.juegos.forEach(function (j, i) {
    var b = document.createElement("button");
    b.dataset.juego = i;
    b.innerHTML = '<img alt=""><span></span>';
    b.querySelector("img").src = j.icono;
    b.querySelector("span").textContent = j.nombre;
    b.addEventListener("click", function () { cambiar({ juego: i }); });
    juegosEl.appendChild(b);
  });

  document.querySelectorAll("[data-cuenta]").forEach(function (b) {
    b.addEventListener("click", function () {
      var ahora = C.ahora();
      var fin = Math.max(estado.finCuenta || 0, ahora);
      var accion = b.dataset.cuenta;
      if (accion === "reiniciar") fin = ahora + cfg.cuentaMinutos * 60000;
      else if (accion === "+1") fin += 60000;
      else fin = Math.max(ahora, fin - 60000);
      cambiar({ finCuenta: fin });
    });
  });

  function mostrarAnuncio(texto) {
    texto = texto.trim();
    if (!texto) return;
    cambiar({ anuncio: { texto: texto, hasta: C.ahora() + SEGUNDOS_ANUNCIO * 1000 } });
  }
  document.getElementById("form-anuncio").addEventListener("submit", function (e) {
    e.preventDefault();
    mostrarAnuncio(textoAnuncio.value);
    textoAnuncio.value = "";
  });
  var rapidosEl = document.getElementById("rapidos");
  (cfg.anunciosRapidos || []).forEach(function (t) {
    var b = document.createElement("button");
    b.textContent = t;
    b.addEventListener("click", function () { mostrarAnuncio(t); });
    rapidosEl.appendChild(b);
  });
  document.getElementById("quitar-anuncio").addEventListener("click", function () {
    cambiar({ anuncio: null });
  });

  cintaEl.addEventListener("change", function () { cambiar({ cinta: cintaEl.checked }); });

  // ---------- Pintar ----------
  function pintar() {
    if (!estado) return;
    document.querySelectorAll("[data-escena]").forEach(function (b) {
      b.classList.toggle("activo", b.dataset.escena === estado.escena);
    });
    document.querySelectorAll("[data-juego]").forEach(function (b) {
      b.classList.toggle("activo", +b.dataset.juego === estado.juego);
    });
    cintaEl.checked = !!estado.cinta;
    tic();
  }

  function tic() {
    if (!estado) return;
    var resto = Math.max(0, Math.ceil((estado.finCuenta - C.ahora()) / 1000));
    var m = Math.floor(resto / 60), s = resto % 60;
    cuentaEl.textContent = resto ? (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s : "¡YA!";
  }

  C.escuchar(function (nuevo) {
    if (!nuevo) {
      estadoEl.textContent = "Esperando al overlay…";
      return;
    }
    estado = nuevo;
    pintar();
  }, marcarConexion);
  setInterval(tic, 250);
})();
