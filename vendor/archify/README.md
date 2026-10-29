# Archify

Runtime de [tt-a1i/archify](https://github.com/tt-a1i/archify), versión 3.0.1,
commit `2ab3cae7ac2c2a55d7386ca789d03c4fcd31816c`, bajo licencia MIT.

Se incluyen el renderer de arquitectura, sus módulos compartidos, las plantillas
y la traducción española. Los ejemplos visuales de `assets/template.html` se han
adaptado a Azure. En modo presentación móvil, el SVG se ajusta al visor en lugar de
forzar 720 px y recortar los componentes laterales; los controles de zoom se conservan.
`renderers/shared/brand-marks.mjs` registra localmente el icono Microsoft Azure del
componente `ProviderMark` del panel, sin descargar imágenes externas.
El resto del runtime conserva el contenido original.
`upstream.json` registra las sumas SHA-256 originales y la adaptación local en
`localOverrides`. Las licencias están en `LICENSE` y
`THIRD_PARTY_NOTICES.md`.

La arquitectura se define en `docs/architecture.json`; la ejecución aislada del
renderer está en `scripts/render-architecture.mjs`. No se necesita instalar una
skill global ni contactar con Archify para consultar el diagrama.
