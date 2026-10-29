/** @format */

import { CONSTANTS } from "./constants.js";

export const SNAPSHOT_VERSION = 1;
const MAX_IDLE_COOLDOWN = 60;
const DEFAULT_ZOOM = 1.0;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function pickEnum<T>(value: T, allowed: Set<T>, fallback: T): T {
  return allowed.has(value) ? value : fallback;
}

const MOVE_AXES = new Set(["x", "y"] as const);
const FACINGS = new Set(["left", "right"] as const);
const IDLE_ACTIONS = new Set(["sofa", "coffee", "plant", "chatting"] as const);

function sanitizeAgent(raw: any) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { x, y, targetX, targetY, idleCooldown, moveAxis, idleAction, facing } = raw;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(targetX) ||
    !Number.isFinite(targetY) ||
    !Number.isFinite(idleCooldown)
  ) {
    return null;
  }
  return {
    x: clamp(x, 0, CONSTANTS.CANVAS_WIDTH),
    y: clamp(y, 0, CONSTANTS.CANVAS_HEIGHT),
    targetX: clamp(targetX, 0, CONSTANTS.CANVAS_WIDTH),
    targetY: clamp(targetY, 0, CONSTANTS.CANVAS_HEIGHT),
    moveAxis: pickEnum(moveAxis, MOVE_AXES, "x"),
    idleAction: pickEnum(idleAction, IDLE_ACTIONS, "sofa"),
    idleCooldown: clamp(Math.round(idleCooldown), 0, MAX_IDLE_COOLDOWN),
    facing: pickEnum(facing, FACINGS, "right"),
  };
}

function sanitizeCamera(raw: any) {
  const zoom = raw && Number.isFinite(raw.zoom) ? clamp(raw.zoom, CONSTANTS.ZOOM_MIN, CONSTANTS.ZOOM_MAX) : DEFAULT_ZOOM;
  return { zoom };
}

function sanitizeScroll(raw: any) {
  const left = raw && Number.isFinite(raw.left) && raw.left >= 0 ? raw.left : 0;
  const top = raw && Number.isFinite(raw.top) && raw.top >= 0 ? raw.top : 0;
  return { left, top };
}

export function sanitizeSnapshot(raw: any) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.version !== SNAPSHOT_VERSION) return null;
  const agents: Record<string, any> = {};
  if (raw.agents && typeof raw.agents === "object" && !Array.isArray(raw.agents)) {
    for (const [id, value] of Object.entries(raw.agents)) {
      const agent = sanitizeAgent(value);
      if (agent) agents[id] = agent;
    }
  }
  return {
    version: SNAPSHOT_VERSION,
    savedAt: Number.isFinite(raw.savedAt) && raw.savedAt >= 0 ? raw.savedAt : 0,
    camera: sanitizeCamera(raw.camera),
    scroll: sanitizeScroll(raw.scroll),
    agents,
  };
}

export function serializeSnapshot({ agents = {}, camera = {}, container = null }: { agents?: Record<string, any>; camera?: any; container?: HTMLElement | null }) {
  const serializedAgents: Record<string, any> = {};
  for (const [id, agent] of Object.entries(agents)) {
    if (!agent) continue;
    serializedAgents[id] = {
      x: agent.x,
      y: agent.y,
      targetX: agent.targetX,
      targetY: agent.targetY,
      moveAxis: agent.moveAxis,
      idleAction: agent.idleAction ?? null,
      idleCooldown: agent.idleCooldown,
      facing: agent.facing,
    };
  }
  return sanitizeSnapshot({
    version: SNAPSHOT_VERSION,
    savedAt: Date.now(),
    camera: { zoom: camera.zoom },
    scroll: container ? { left: container.scrollLeft, top: container.scrollTop } : { left: 0, top: 0 },
    agents: serializedAgents,
  });
}

export function getStorageKey(projectId = "default"): string {
  return `agent-god-view:${projectId}:state.v1`;
}

export function safeLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSnapshot(projectId = "default", storage = safeLocalStorage()): any {
  if (!storage) return null;
  try {
    const text = storage.getItem(getStorageKey(projectId));
    if (!text) return null;
    return sanitizeSnapshot(JSON.parse(text));
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: any, projectId = "default", storage = safeLocalStorage()): boolean {
  if (!storage) return false;
  try {
    const normalized = sanitizeSnapshot(snapshot);
    if (!normalized) return false;
    storage.setItem(getStorageKey(projectId), JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}
