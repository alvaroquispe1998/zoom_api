// src/services/meeting.service.js
import { cfg } from "../config/env.js";
import { listMeetingsAll, createMeetingZoom } from "./zoom.service.js";
import { parseLocal, toUTC } from "../utils/time.js";
/**
 * Une listas de reuniones LIVE y UPCOMING evitando duplicados.
 * Si un mismo (id, occurrence_id) aparece en ambos, se prioriza LIVE.
 */
function dedupMeetings(live, upcoming) {
  const map = new Map();

  const push = (m, source) => {
    const key = `${m.id}:${m.occurrence_id || "single"}`;
    if (!map.has(key)) {
      map.set(key, { ...m, source });
    } else {
      // Promueve LIVE por encima de UPCOMING
      const cur = map.get(key);
      if (cur.source !== "LIVE" && source === "LIVE") {
        map.set(key, { ...m, source });
      }
    }
  };

  upcoming.forEach(m => push(m, "UPCOMING"));
  live.forEach(m => push(m, "LIVE"));

  return Array.from(map.values());
}

/**
 * Calcula inicio/fin en UTC de una reunión Zoom.
 * Zoom entrega start_time en ISO (UTC) y duration en minutos.
 */
function meetingEndUTC(m) {
  const startUTC = parseLocal(m.start_time, "UTC");
  const endUTC = m.duration
    ? startUTC.add(m.duration, "minute")
    : startUTC.add(60, "minute"); // fallback 60 min si no hubiera duración
  return { startUTC, endUTC };
}

/**
 * Carga hosts desde src/config/host.json.
 * Estructura esperada:
 *   { "hosts": ["host1@dom.com", "host2@dom.com"] }
 */
// REEMPLAZA tu loadHosts() por este
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

async function loadHosts() {
  // __dirname en ESM
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // host.json junto a src/config/host.json (ajusta si lo tienes en otro lado)
  const filePath = path.resolve(__dirname, "../config/host.json");

  try {
    if (!fs.existsSync(filePath)) {
      console.error("[HOSTS] host.json NO existe en:", filePath);
      return [];
    }

    const raw = await fs.promises.readFile(filePath, "utf8");

    // Acepta tanto { "hosts": [...] } como [ ... ]
    let hostsParsed;
    try {
      hostsParsed = JSON.parse(raw);
    } catch (e) {
      console.error("[HOSTS] JSON inválido en host.json:", e.message);
      return [];
    }

    const hosts = Array.isArray(hostsParsed)
      ? hostsParsed
      : Array.isArray(hostsParsed?.hosts)
        ? hostsParsed.hosts
        : [];

    const clean = hosts.map(String).map(s => s.trim()).filter(Boolean);

    console.log("[HOSTS] source: host.json path:", filePath, "values:", clean);
    return clean;
  } catch (e) {
    console.error("[HOSTS] Error leyendo host.json:", e);
    return [];
  }
}


/**
 * Busca solapes para un usuario (host) dado un rango solicitado.
 * Toma las reuniones LIVE y UPCOMING, deduplica, filtra por
 * reuniones en curso o futuras y compara en UTC contra el rango pedido.
 */
export async function findOverlapsForUser({ userId, reqStartLocal, reqEndLocal }) {
  console.time(`[overlap] user=${userId}`);
  const maxC = Number.isInteger(cfg?.maxConcurrent) ? cfg.maxConcurrent : 1;

  // LIVE + UPCOMING en paralelo y con stopAt
  const [live, upcoming] = await Promise.all([
    listMeetingsAll({ userId, type: "live", pageSize: 30, stopAt: maxC }),
    listMeetingsAll({ userId, type: "upcoming", pageSize: 30, stopAt: maxC }),
  ]);

  const all = dedupMeetings(live, upcoming);

  const nowUTC = toUTC(reqStartLocal).utc();
  const futureOrOngoing = all.filter(m => meetingEndUTC(m).endUTC.isAfter(nowUTC));

  const reqStartUTC = toUTC(reqStartLocal);
  const reqEndUTC = toUTC(reqEndLocal);

  const overlaps = [];
  for (const m of futureOrOngoing) {
    const { startUTC, endUTC } = meetingEndUTC(m);
    if (reqStartUTC.isBefore(endUTC) && startUTC.isBefore(reqEndUTC)) {
      overlaps.push(m);
      if (overlaps.length >= maxC) break; // ⬅️ corta a 2
    }
  }

  console.timeEnd(`[overlap] user=${userId}`);
  return overlaps;
}

// Secuencial por host: corta en el primero con cupo
export async function chooseHostAndCreate({ topic, agenda, startLocal, endLocal, timezone }) {
  console.time("[choose]");
  const durationMin = endLocal.diff(startLocal, "minute");
  if (durationMin <= 0) throw new Error("Rango de tiempo inválido");
  const startLocalISO = startLocal.format("YYYY-MM-DDTHH:mm:ss");

  const hosts = await loadHosts();
  if (!hosts.length) throw new Error("No hay hosts configurados");
  const maxConcurrent = Number.isInteger(cfg?.maxConcurrent) ? cfg.maxConcurrent : 1;

  const checked = [];
  for (const userId of hosts) {
    const overlaps = await findOverlapsForUser({
      userId, reqStartLocal: startLocal, reqEndLocal: endLocal
    });
    checked.push({ userId, overlaps });

    if (overlaps.length < maxConcurrent) {
      const created = await createMeetingZoom({
        userId, topic, agenda, startLocalISO, durationMin, timezone
      });
      console.timeEnd("[choose]");
      return { conflict: false, host: userId, created };
    }
  }

  console.timeEnd("[choose]");
  return { conflict: true, detail: checked };
}
//AGREDADO PARA OBTENER ULTIMAS REUNIONES POR TEMA
export async function getLastMeetingsByTopic({ hosts } = {}) {
  // 1) Determinar lista de hosts
  let hostList = Array.isArray(hosts) && hosts.length ? [...hosts] : [];

  // Si no vienen por parámetro, tomamos los de host.json
  if (!hostList.length) {
    const fromFile = await loadHosts();
    hostList.push(...fromFile);
  }

  // Como fallback extra, aprovechamos lo de env si lo usas
  if (!hostList.length && Array.isArray(cfg.hostsEnv) && cfg.hostsEnv.length) {
    hostList.push(...cfg.hostsEnv);
  }

  // Fallback final: singleUserId si lo tuvieras configurado
  if (!hostList.length && cfg.singleUserId) {
    hostList.push(cfg.singleUserId);
  }

  if (!hostList.length) {
    throw Object.assign(
      new Error("No hay hosts configurados para buscar reuniones"),
      { status: 400 }
    );
  }

  const topicsMap = new Map();
  const pageSize = cfg.zoomPageSize || 20;

  for (const userId of hostList) {
    // 2) Traer reuniones SCHEDULED del usuario
    const meetings = await listMeetingsAll({
      userId,
      type: "scheduled",
      pageSize,
      // stopAt: opcional si quieres cortar antes
    });

    for (const m of meetings) {
      if (!m.topic) continue; // ignoramos sin topic

      const topic = m.topic;
      const { startUTC, endUTC } = meetingEndUTC(m); // ya existe en tu archivo

      const current = topicsMap.get(topic);
      // Si no hay registro o esta reunión termina más tarde, se reemplaza
      if (!current || endUTC.isAfter(current.endUTC)) {
        topicsMap.set(topic, {
          topic,
          user_id: userId,
          meeting_id: m.id,
          start_time: startUTC.toISOString(),
          end_time: endUTC.toISOString(),
          duration: m.duration,
          join_url: m.join_url,
          endUTC, // solo interno para comparación
        });
      }
    }
  }

  // 3) Devolvemos un array plano sin el campo interno endUTC
  return Array.from(topicsMap.values()).map(({ endUTC, ...rest }) => rest);
}