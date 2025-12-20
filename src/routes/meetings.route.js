import { Router } from "express";
import { cfg } from "../config/env.js";
import { parseLocal } from "../utils/time.js";
import { chooseHostAndCreate, getLastMeetingsByTopic, listMeetingsForHosts } from "../services/meeting.service.js";
import { deleteMeetingZoom, listLicensedUsers } from "../services/zoom.service.js";
import { listRecordingsForHosts } from "../services/meeting.service.js";


const router = Router();

router.post("/auto", async (req, res, next) => {
  try {
    const { topic, agenda, start_time, end_time, timezone } = req.body || {};
    if (!topic || !start_time || !end_time) {
      return res.status(400).json({ error: "Faltan campos: topic, start_time, end_time" });
    }

    const tz = timezone || cfg.tzDefault || "America/Lima";
    const startLocal = parseLocal(start_time, tz);
    const endLocal = parseLocal(end_time, tz);

    const result = await chooseHostAndCreate({
      topic,
      agenda,
      startLocal,
      endLocal,
      timezone: tz,
    });

    if (result.conflict) {
      return res.status(409).json({
        error: `Límite de concurrencia (${cfg.maxConcurrent}) alcanzado en el rango solicitado`,
        hosts_checked: result.detail.map(r => ({
          user: r.userId,
          overlaps: r.overlaps.map(m => ({
            id: m.id,
            topic: m.topic,
            start_time: m.start_time,
            duration: m.duration,
          })),
        })),
      });
    }

    // ✅ Aquí usamos 'created' del service (como pediste)
    const { created } = result;

    return res.status(201).json({
      // ok: true,
      host: result.host,
      //  meeting: {
        id: created.id,
        topic: created.topic,
        //  status: created.status,
        start_time: created.start_time, // ISO UTC de Zoom
        duration: created.duration,
        // timezone: created.timezone || tz,
        join_url: created.join_url,
        // ⚠️ start_url es solo para el host/admin; inclúyelo solo si la respuesta es privada:
        start_url: created.start_url,
    //  },
    });
  } catch (err) {
    next(err);
  }
});

// ====== NUEVO: eliminar reunión por ID ======
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Falta el id de la reunión" });
    }

    await deleteMeetingZoom(id);
    // 204 = No Content
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ====== NUEVO: listar usuarios activos con licencia ======
router.get("/users/licensed", async (_req, res, next) => {
  try {
    const users = await listLicensedUsers();
    
    // Si quieres devolver solo información básica:
    const simplified = users.map(u => ({
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      type: u.type, // 2 = Licensed
    }));

    return res.json({ total: simplified.length, users: simplified });
  } catch (err) {
    next(err);
  }
});

// ====== NUEVO: última reunión por tema (distinct por topic) ======
// GET /api/meetings/last-by-topic?hosts=correo1,correo2
router.get("/last-by-topic", async (req, res, next) => {
  try {
    const { hosts } = req.query;

    // hosts opcional: lista separada por comas
    let hostsArr = undefined;
    if (hosts) {
      hostsArr = String(hosts)
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean);
    }

    const items = await getLastMeetingsByTopic({ hosts: hostsArr });

    return res.json({
      // total: items.length,
      items,
    });
  } catch (err) {
    next(err);
  }
});

// ====== NUEVO: listar reuniones de TODOS los hosts de host.json ======
// GET /api/meetings/hosts?type=scheduled&from=2025-11-01&to=2025-11-30&topic=CLASE&timezone=America/Lima
router.get("/hosts", async (req, res, next) => {
  try {
    const {
      type,
      from,
      to,
      topic,
      timezone,
    } = req.query;

    const data = await listMeetingsForHosts({
      type: type || "scheduled",
      from,
      to,
      topic,
      timezone,
    });

    return res.json(data);
  } catch (err) {
    next(err);
  }
});

// ✅ LISTAR GRABACIONES (cloud) DE TODOS LOS HOSTS
// GET /api/meetings/recordings?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/recordings", async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await listRecordingsForHosts({ from, to });
    return res.json(data);
  } catch (err) {
    next(err);
  }
});


export default router;
    