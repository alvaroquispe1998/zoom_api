import { Router } from "express";
import { cfg } from "../config/env.js";
import { parseLocal } from "../utils/time.js";
import { chooseHostAndCreate } from "../services/meeting.service.js";
import { deleteMeetingZoom, listLicensedUsers } from "../services/zoom.service.js";

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

export default router;
    