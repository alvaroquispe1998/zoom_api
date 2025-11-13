// src/services/zoom.service.js
import axios from "axios";
import https from "https";
import { cfg } from "../config/env.js";

// Bases (con fallback a constantes)
const ZOOM_BASE = cfg.zoomBaseUrl || "https://api.zoom.us/v2";
const OAUTH_BASE = cfg.zoomOauthUrl || "https://zoom.us/oauth/token";

// ---------- Keep-Alive ----------
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

// ---------- Token cache ----------
let TOKEN_CACHE = {
  access_token: null,
  expires_at: 0 // epoch ms
};

async function fetchAccessToken() {
  const { accountId, clientId, clientSecret } = cfg.zoom || {};
  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom OAuth config incompleta (accountId/clientId/clientSecret).");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const url = `${OAUTH_BASE}?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`;

  const { data } = await axios.post(url, null, {
    headers: { Authorization: `Basic ${auth}` },
    httpsAgent,
    timeout: 10000
  });

  // Guarda token y vencimiento (quita 60s de margen)
  const now = Date.now();
  const ttl = Math.max(0, (data.expires_in || 3600) - 60) * 1000;

  TOKEN_CACHE.access_token = data.access_token;
  TOKEN_CACHE.expires_at = now + ttl;

  return TOKEN_CACHE.access_token;
}

async function getAccessToken() {
  const now = Date.now();
  if (TOKEN_CACHE.access_token && now < TOKEN_CACHE.expires_at) {
    return TOKEN_CACHE.access_token;
  }
  return fetchAccessToken();
}

// ---------- Cliente Zoom con interceptor ----------
const zoomApi = axios.create({
  baseURL: ZOOM_BASE,
  timeout: 10000,
  httpsAgent
});

// Inyecta Bearer automáticamente en cada request
zoomApi.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  config.headers = config.headers || {};
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------- API wrappers ----------
/**
 * Lista reuniones del usuario.
 * @param {object} opts
 * @param {string} opts.userId
 * @param {"live"|"upcoming"|"scheduled"} opts.type
 * @param {number} [opts.pageSize=30]
 * @param {string} [opts.start_time_from]  // ISO UTC, si tu implementación lo soporta
 * @param {string} [opts.start_time_to]    // ISO UTC, si tu implementación lo soporta
 * @param {number} [opts.stopAt]           // corta temprano si acumulaste >= stopAt
 */
// listMeetingsAll: agrega stopAt y pageSize
export async function listMeetingsAll({
  userId, type, pageSize = 30, stopAt
}) {
  console.time(`[zoom] list ${type} user=${userId}`);
  let next_page_token;
  const all = [];
  do {
    const { data } = await zoomApi.get(`/users/${encodeURIComponent(userId)}/meetings`, {
      params: { type, page_size: pageSize, next_page_token }
    });
    const items = data?.meetings || [];
    all.push(...items);
    if (stopAt && all.length >= stopAt) break;     // ⬅️ corta temprano
    next_page_token = data?.next_page_token;
  } while (next_page_token);
  console.timeEnd(`[zoom] list ${type} user=${userId}`);
  return all;
}


/**
 * Crea una reunión.
 * @param {object} payload
 * @param {string} payload.userId
 * @param {string} payload.topic
 * @param {string} payload.agenda
 * @param {string} payload.startLocalISO // LOCAL sin Z (ej: "2025-11-09T10:00:00")
 * @param {number} payload.durationMin
 * @param {string} payload.timezone      // ej: "America/Lima"
 */
export async function createMeetingZoom({ userId, topic, agenda, startLocalISO, durationMin, timezone }) {
  const payload = {
    topic,
    agenda,
    type: 2, // scheduled
    start_time: startLocalISO, // LOCAL sin Z
    duration: durationMin,
    timezone,
    settings: {
      join_before_host: false,
      waiting_room: true
    }
  };

  const { data } = await zoomApi.post(`/users/${encodeURIComponent(userId)}/meetings`, payload);
  return data;
}

// 🔹 Eliminar una reunión por ID
export async function deleteMeetingZoom(meetingId) {
  if (!meetingId) {
    throw Object.assign(new Error("meetingId es requerido"), { status: 400 });
  }

  await zoomApi.delete(`/meetings/${encodeURIComponent(meetingId)}`);
  // Zoom devuelve 204 sin body si todo va bien
  return true;
}

// 🔹 Listar todos los usuarios ACTIVOS con licencia
export async function listLicensedUsers({ pageSize = cfg.zoomPageSize || 30 } = {}) {
  let next_page_token;
  const all = [];

  do {
    const { data } = await zoomApi.get("/users", {
      params: {
        status: "active",      // solo usuarios activos
        page_size: pageSize,
        next_page_token,
      },
    });

    const users = data?.users || [];
    // type: 1 = Basic, 2 = Licensed, 3 = On-Prem
    all.push(...users.filter(u => u.type === 2));

    next_page_token = data?.next_page_token;
  } while (next_page_token);

  return all;
}