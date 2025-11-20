// src/services/workspace.service.js
import { cfg } from "../config/env.js";
import { parseLocal, toUTC } from "../utils/time.js";
import {
  listWorkspacesZoom,
  listWorkspaceReservationsZoom,
  createWorkspaceReservationZoom,
  deleteWorkspaceReservationZoom,
} from "./zoom.service.js";

// 🔹 1. Listar espacios de trabajo (workspaces de Zoom)
export async function listWorkspaces({ locationId } = {}) {
  const all = await listWorkspacesZoom();  // 🔸 NO le pasamos location_id a Zoom

  let filtered = all;
  if (locationId) {
    filtered = all.filter(
      (ws) => String(ws.location_id) === String(locationId)
    );
  }

  return { total: filtered.length, workspaces: filtered };
}

// 🔹 2. Listar reservas de un workspace
export async function listReservations({
  workspaceId,
  from,
  to,
  timezone,
  userId,
}) {
  const tz = timezone || cfg.tzDefault || "America/Lima";

  let fromUtc, toUtc;

  if (from) {
    const dFrom = parseLocal(from, tz);
    if (!dFrom.isValid()) {
      throw Object.assign(new Error("Parámetro 'from' inválido"), { status: 400 });
    }
    fromUtc = toUTC(dFrom).toISOString(); // -> 2025-11-20T00:00:00Z
  }

  if (to) {
    const dTo = parseLocal(to, tz);
    if (!dTo.isValid()) {
      throw Object.assign(new Error("Parámetro 'to' inválido"), { status: 400 });
    }
    toUtc = toUTC(dTo).toISOString();
  }

  const data = await listWorkspaceReservationsZoom({
    workspaceId,
    from: fromUtc,
    to: toUtc,
    userId,
  });

  // Devolvemos tal cual responde Zoom, pero sumando workspaceId por claridad
  return { workspace_id: workspaceId, ...data };
}

// 🔹 3. Crear reserva en un workspace
export async function createReservation({
  workspaceId,
  start_time,
  end_time,
  timezone,
  topic,
  reserve_for,
  meeting,
}) {
  const tz = timezone || cfg.tzDefault || "America/Lima";

  if (!start_time || !end_time) {
    throw Object.assign(
      new Error("start_time y end_time son obligatorios"),
      { status: 400 }
    );
  }

  const startLocal = parseLocal(start_time, tz);
  const endLocal = parseLocal(end_time, tz);

  if (!startLocal.isValid() || !endLocal.isValid()) {
    throw Object.assign(
      new Error("start_time o end_time inválidos"),
      { status: 400 }
    );
  }

  if (!endLocal.isAfter(startLocal)) {
    throw Object.assign(
      new Error("end_time debe ser mayor que start_time"),
      { status: 400 }
    );
  }

  const payload = {
    // Zoom espera UTC con Z
    start_time: toUTC(startLocal).toISOString(),
    end_time: toUTC(endLocal).toISOString(),
  };

  if (topic) payload.topic = topic;
  if (reserve_for) payload.reserve_for = reserve_for; // Zoom User ID
  if (meeting) payload.meeting = meeting;            // objeto meeting si es Room

  const data = await createWorkspaceReservationZoom({ workspaceId, payload });
  return data;
}

// 🔹 4. Eliminar reserva
export async function deleteReservation({ workspaceId, reservationId }) {
  await deleteWorkspaceReservationZoom({ workspaceId, reservationId });
}
