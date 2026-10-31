# Vexlow Live

Overlay para los lives de TikTok: logo, juegos, cuenta regresiva y mensajes.
Es una página web estática (HTML + CSS + JS, sin instalar nada) en formato vertical **1080×1920**.

> Proyecto **separado** de vexlowhq.com: otro repo, otro dominio y marcado como `noindex`
> (no aparece en Google y no afecta a la web principal ni a su monetización).

## Escenas

| Tecla | Escena  | Para qué |
|-------|---------|----------|
| `1`   | Inicio  | Logo + "Empezamos en" con cuenta regresiva |
| `2`   | Juego   | Marco con barra "EN VIVO", tarjeta del juego y cinta. El centro queda libre para el juego |
| `3`   | Pausa   | "Ya volvemos..." |
| `4`   | Cierre  | "¡Gracias por ver!" + vitrina de juegos |

Otros atajos: `←` `→` cambiar juego · `R` reiniciar cuenta · `+` `-` sumar/restar 1 minuto ·
`T` mostrar/ocultar cinta · `H` ayuda (no la dejes abierta en vivo).

La página recuerda la última escena, así que si se recarga no se pierde.

## Editar textos y juegos

Todo está en **`config.js`**: nombre, usuario de TikTok, minutos de la cuenta, lista de juegos
y mensajes de la cinta. Para agregar un juego, poné su ícono en `img/` y sumá una entrada a `juegos`.

## Opciones por URL

```
?escena=juego          escena inicial (inicio | juego | pausa | cierre)
?juego=aqua            juego inicial (busca por nombre)
?cuenta=10             reinicia la cuenta a 10 minutos
?fondo=transparente    fondo transparente (en OBS se pone solo)
?fondo=verde           fondo verde para usar filtro de chroma key
?cinta=no              arranca con la cinta oculta
?ayuda                 abre la ayuda
```

## Uso con dos PCs

**Probar en la red de casa:** en la PC 1 correr

```
python -m http.server 4800 --bind 0.0.0.0
```

dentro de esta carpeta y en la PC 2 abrir `http://<IP-de-la-PC-1>:4800`.
(Si no carga, permitir Python en el firewall de Windows para redes privadas.)

**Para los lives:** publicar este repo como proyecto aparte en Vercel
(Add New → Project → Vexlowlive, sin build) y usar la URL `*.vercel.app`.

**En la PC 2 (la del live):**

- **OBS:** Fuente → Navegador → URL del overlay, ancho 1080, alto 1920.
  El fondo queda transparente; poné la captura del juego *debajo* del overlay.
  Para usar las teclas: clic derecho en la fuente → *Interactuar*.
- **TikTok LIVE Studio u otro programa sin fondo transparente:** abrir el overlay con
  `?fondo=verde`, capturarlo y aplicarle filtro de chroma key verde.
