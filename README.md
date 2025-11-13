# ZOOM API

API minimalista para **crear reuniones de Zoom automáticamente** seleccionando el mejor host disponible (sin solapes, respetando concurrencia).

---

## 🧭 Changelog

| Fecha | Versión | Descripción |
|--------|----------|-------------|
| 2025-11-08 | v1.0.0 | Versión inicial estable con control de solapes, concurrencia y carga dinámica de hosts desde `host.json`. |
| 2025-11-09 | v1.1.0 | Limpieza de respuesta (`created` lean) y correcciones en `meetings.route.js`. Se añade README y Makefile. |

---

## 🚀 Requisitos

- **Node.js ≥ 18**
- App Zoom **Server-to-Server OAuth** configurada.
- NPM o PNPM.
- Conectividad hacia la API de Zoom.

---

## ⚙️ Instalación

```bash
git clone <repo>
cd zoom-api
npm install
