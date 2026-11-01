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
    C.enviar(cambios).catch(function () { marcarConexion(false); });
  }

  // ---------- Muertes, textos y regalos ----------
  document.querySelectorAll("[data-muertes]").forEach(function (b) {
    b.addEventListener("click", function () {
      var v = b.dataset.muertes, m = estado.muertes || 0;
      cambiar({ muertes: v === "0" ? 0 : Math.max(0, m + (+v)) });
    });
  });

  document.querySelectorAll("[data-texto]").forEach(function (form) {
    var input = form.querySelector("input");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = input.value.trim();
      var campo = form.dataset.texto;
      if (campo === "reto") cambiar({ reto: { texto: v, hecho: false } });
      else if (campo === "meta") {
        if (+v > 0) cambiar({ regalos: Object.assign({}, regalos(), { meta: +v }) });
      } else {
        var c = {};
        c[campo] = v;
        cambiar(c);
      }
      input.blur();
    });
  });

  var retoHecho = document.getElementById("reto-hecho");
  retoHecho.addEventListener("change", function () {
    cambiar({ reto: Object.assign({ texto: cfg.reto }, estado.reto, { hecho: retoHecho.checked }) });
  });

  function regalos() {
    return Object.assign({ meta: cfg.metaRegalos || 1000, diamantes: 0, top: [] }, estado && estado.regalos);
  }
  document.getElementById("reiniciar-regalos").addEventListener("click", function () {
    if (!confirm("¿Poner los regalos en cero?")) return;
    cambiar({ regalos: { meta: regalos().meta, diamantes: 0, top: [], ultimo: null } });
  });
  document.getElementById("simular-regalo").addEventListener("click", function () {
    C.evento({
      event: "gift",
      data: { msgId: "prueba-" + Date.now(), nickname: "Prueba", giftName: "Rosa", repeatCount: 1, diamondCount: 1, giftType: 2 },
    });
  });

  // Rellena los campos de texto con lo que está en pantalla (solo si no estás escribiendo)
  function pintarTextos() {
    var valores = {
      titulo: estado.titulo || "",
      gancho: estado.gancho || "",
      reto: (estado.reto && estado.reto.texto) || cfg.reto || "",
      meta: regalos().meta,
    };
    document.querySelectorAll("[data-texto] input").forEach(function (input) {
      if (document.activeElement !== input) input.value = valores[input.closest("form").dataset.texto];
    });
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
    document.getElementById("muertes").textContent = estado.muertes || 0;
    retoHecho.checked = !!(estado.reto && estado.reto.hecho);
    var r = regalos();
    document.getElementById("resumen-regalos").textContent = r.diamantes + " / " + r.meta + " 💎"
      + (r.top.length ? " · Top: " + r.top.slice(0, 3).map(function (t) { return t.nombre; }).join(", ") : "");
    pintarTextos();
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
