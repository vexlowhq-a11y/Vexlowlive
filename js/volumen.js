// Reguladores de volumen (juego y micrófono). Están en el emisor y en el panel;
// el volumen se aplica en el overlay de la PC 2, así esta PC no hace trabajo extra.
window.VexlowVolumen = (function () {
  "use strict";

  var C = window.VexlowConexion;
  var volumen = { juego: 100, mic: 100 };
  var entradas = document.querySelectorAll("[data-volumen]");
  var espera = null;

  function mostrar(input) {
    input.parentElement.querySelector("output").textContent = input.value + "%";
  }

  entradas.forEach(function (input) {
    input.addEventListener("input", function () {
      volumen[input.dataset.volumen] = +input.value;
      mostrar(input);
      // Mientras arrastrás no mandamos cada pasito: como mucho 10 por segundo
      if (!espera) {
        espera = setTimeout(function () {
          espera = null;
          C.enviar({ volumen: volumen });
        }, 100);
      }
    });
  });

  return {
    // Pone los reguladores como están en el live (salvo el que estás moviendo)
    pintar: function (v) {
      if (!v) return;
      volumen = { juego: v.juego != null ? v.juego : 100, mic: v.mic != null ? v.mic : 100 };
      entradas.forEach(function (input) {
        if (document.activeElement === input) return;
        input.value = volumen[input.dataset.volumen];
        mostrar(input);
      });
    },
  };
})();
