export function errorHandler(err, _req, res, _next) {
console.error("[ERROR]", err?.response?.data || err.stack || err.message);
const status = err.status || 500;
res.status(status).json({ error: err.message || "Error interno", detail: err?.response?.data });
}