// src/routes/workspaces.route.js
import { Router } from "express";
import {
  listWorkspaces,
  listReservations,
  createReservation,
  deleteReservation,
} from "../services/workspace.service.js";

const router = Router();

// ✅ 1. LISTAR ESPACIOS DE TRABAJO
// GET /api/workspaces
router.get("/", async (_req, res, next) => {
  try {
    const data = await listWorkspaces();
    return res.json(data);
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

export default router;
