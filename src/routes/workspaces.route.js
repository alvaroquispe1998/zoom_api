import { Router } from "express";
import {
  listWorkspaces,
  listReservations,
  createReservation,
  deleteReservation,
} from "../services/workspace.service.js";
import { listRoomLocationsZoom } from "../services/zoom.service.js"; // ⬅️ NUEVO


const router = Router();

// ✅ 1. LISTAR ESPACIOS DE TRABAJO
// GET /api/workspaces?location_id=xxx
router.get("/", async (req, res, next) => {
  try {
    const { location_id } = req.query;

    const result = await listWorkspaces({
      locationId: location_id || null,
    });

    return res.json(result); // { total, workspaces }
  } catch (err) {
    next(err);
  }
});

// ✅ 2. LISTAR RESERVAS DE UN ESPACIO
// GET /api/workspaces/:id/reservations?from=...&to=...&timezone=...&user_id=...
router.get("/:id/reservations", async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const { from, to, timezone, user_id } = req.query;

    const data = await listReservations({
      workspaceId,
      from,
      to,
      timezone,
      userId: user_id,
    });

    return res.json(data);
  } catch (err) {
    next(err);
  }
});

// ✅ 3. CREAR RESERVA EN UN ESPACIO
// POST /api/workspaces/:id/reservations
router.post("/:id/reservations", async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const { start_time, end_time, timezone, topic, reserve_for, meeting } =
      req.body || {};

    if (!start_time || !end_time) {
      return res.status(400).json({
        error: "Faltan campos obligatorios: start_time, end_time",
      });
    }

    const created = await createReservation({
      workspaceId,
      start_time,
      end_time,
      timezone,
      topic,
      reserve_for,
      meeting,
    });

    return res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ✅ 4. ELIMINAR RESERVA
// DELETE /api/workspaces/:id/reservations/:reservationId
router.delete("/:id/reservations/:reservationId", async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const reservationId = req.params.reservationId;

    await deleteReservation({ workspaceId, reservationId });
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ✅ EXTRA: LISTAR LOCATIONS (para saber qué location_id usar)
// GET /api/workspaces/locations?parent_location_id=&type=&page_size=
router.get("/locations", async (req, res, next) => {
  try {
    const {
      parent_location_id: parentLocationId,
      type,
      page_size,
    } = req.query;

    const locations = await listRoomLocationsZoom({
      parentLocationId: parentLocationId || undefined,
      type: type || undefined,
      pageSize: page_size ? Number(page_size) : undefined,
    });

    return res.json({
      total: locations.length,
      locations,
    });
  } catch (err) {
    next(err);
  }
});


export default router;


