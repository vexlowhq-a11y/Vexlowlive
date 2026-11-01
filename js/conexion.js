// Conexión con server.js: recibe el estado en tiempo real, lo envía
// y pasa las señales WebRTC entre el emisor (PC 1) y los overlays (PC 2).
// Si la página se sirve sin server.js (por ejemplo en Vercel), no hace nada.
window.VexlowConexion = (function () {
  "use strict";

  var desfase = 0; // diferencia entre el reloj del servidor y el de este equipo
  var id = Math.random().toString(36).slice(2, 10);
  var alSenal = function () {};

  function ahora() { return Date.now() + desfase; }

  function escuchar(alRecibir, alCambiarConexion, rol) {
    fetch("api/estado", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function () {
        var es = new EventSource("api/eventos?id=" + id + "&rol=" + (rol || "panel"));
        es.onopen = function () { alCambiarConexion(true); };
        es.onerror = function () { alCambiarConexion(false); };
        es.onmessage = function (e) {
          var m = JSON.parse(e.data);
          desfase = m.ahora - Date.now();
          alRecibir(m.estado);
        };
        es.addEventListener("senal", function (e) { alSenal(JSON.parse(e.data)); });
      })
      .catch(function () {
        // El servidor todavía no está (o se está reiniciando): reintentamos solos
        alCambiarConexion(null);
        setTimeout(function () { escuchar(alRecibir, alCambiarConexion, rol); }, 3000);
      });
  }

  function publicar(ruta, datos) {
    return fetch(ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
  }

  return {
    id: id,
    ahora: ahora,
    escuchar: escuchar,
    // Envía solo los campos que cambiaron; el servidor los mezcla con el resto
    enviar: function (cambios) { return publicar("api/estado", cambios); },
    senal: function (para, tipo, datos) { return publicar("api/senal", { de: id, para: para, tipo: tipo, datos: datos }); },
    alSenal: function (fn) { alSenal = fn; },
    evento: function (ev) { return publicar("api/evento", ev); },
  };
})();
