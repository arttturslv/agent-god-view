/** @format */

export const CONSTANTS = {
  CANVAS_WIDTH: 920,
  CANVAS_HEIGHT: 540,
  WALK_SPEED: 1.35,
  ZOOM_MIN: 0.6,
  ZOOM_MAX: 8,
  BUBBLE_DURATION: 260,
  STATUS_BUBBLE_TICKS: 1_800_000,
  PERMISSION_BUBBLE_TICKS: 1_800_000,
  IDLE_CYCLE_TICK_MS: 1000,
};

export const BUBBLE_PRIORITY = {
  STATUS: 1,
  EVENT: 2,
};

export const STATUS_LABELS: Record<string, string> = {
  working: "trabalhando",
  reading: "lendo",
  waiting: "aguardando",
  waiting_permission: "aguardando aprovação",
  requesting_permission: "aguardando aprovação",
  error: "erro",
  idle: "relaxando",
};

export const STATUS_BUBBLE_TEMPLATES: Record<string, { icon: string; phrase: string; color: string }> = {
  working: { icon: "💻", phrase: "codando", color: "#1e3a2f" },
  reading: { icon: "📖", phrase: "estudando", color: "#0c2a45" },
  waiting: { icon: "⏳", phrase: "no aguardo", color: "#3b2f0b" },
  waiting_permission: { icon: "⚠️", phrase: "aguardando aprovação", color: "#4a1d1d" },
  requesting_permission: { icon: "⚠️", phrase: "aguardando aprovação", color: "#4a1d1d" },
  error: { icon: "❌", phrase: "erro", color: "#5c1818" },
};

export function truncateText(text: string, maxChars = 60): string {
  if (typeof text !== "string") return "";
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;
  const cut = normalized.lastIndexOf(" ", maxChars);
  const body = cut > 0 ? normalized.slice(0, cut) : normalized.slice(0, maxChars);
  return body.replace(/[\s.,;:!?-]+$/, "") + "…";
}

export function getElapsedMinutes(since: number, now = Date.now()): number {
  if (!Number.isFinite(since)) return 0;
  return Math.max(0, Math.floor((now - since) / 60000));
}

export function formatStatusBubbleText({
  status,
  task,
  elapsedMinutes = 0,
}: { status?: string; task?: string; elapsedMinutes?: number } = {}): string {
  if (!status) return "";
  const template = STATUS_BUBBLE_TEMPLATES[status];
  if (!template) return task ? truncateText(task, 42) : "";
  const cleanTask = truncateText(task, 42);
  const base = cleanTask ? `${cleanTask} · ${template.phrase}` : template.phrase;
  const suffix = elapsedMinutes >= 1 ? ` · ${elapsedMinutes} min` : "";
  return `${template.icon} ${base}${suffix}`;
}

export function hashString(value: unknown): number {
  const text = String(value ?? "");
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getWalkSpeed(id: string): number {
  const variation = ((hashString(id) % 1000) / 1000) * 0.4;
  return Number((CONSTANTS.WALK_SPEED * (0.95 + variation)).toFixed(3));
}

export function getAnimOffset(id: string): number {
  return hashString(id) % 240;
}

export function rollIdleCooldown(random = Math.random): number {
  return 7 + Math.floor(random() * 12);
}

export function pickPoi(candidates: string[], recentPois: string[] = [], random = Math.random): string | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const recent = new Set(Array.isArray(recentPois) ? recentPois : []);
  let pool = candidates.filter((poi) => !recent.has(poi));
  if (pool.length === 0) {
    const last = Array.isArray(recentPois) ? recentPois[0] : null;
    pool = candidates.filter((poi) => poi !== last);
  }
  if (pool.length === 0) pool = candidates;
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[index];
}

const PLANT_POIS = ["PLANT_LOUNGE", "PLANT_CORRIDOR"];
const IDLE_ACTIONS = ["coffee", "plant", "sofa"];
const IDLE_ACTION_WEIGHTS: Record<string, number> = {
  coffee: 0.25,
  plant: 0.2,
  sofa: 0.55,
};

function rollIdleActionName(previousAction: string | null, random: () => number): string {
  const candidates = IDLE_ACTIONS.filter((action) => action !== previousAction);
  const totalWeight = candidates.reduce(
    (total, action) => total + IDLE_ACTION_WEIGHTS[action],
    0,
  );
  let roll = random() * totalWeight;
  for (const action of candidates) {
    roll -= IDLE_ACTION_WEIGHTS[action];
    if (roll < 0) return action;
  }
  return candidates[candidates.length - 1];
}

export function rollIdleAction({
  previousAction = null,
  recentPois = [],
  random = Math.random,
}: { previousAction?: string | null; recentPois?: string[]; random?: () => number } = {}) {
  const action = rollIdleActionName(previousAction, random);
  let poi = null;
  if (action === "coffee") poi = "COFFEE_MACHINE";
  else if (action === "plant") poi = pickPoi(PLANT_POIS, recentPois, random);
  return { action, poi };
}

export const AGENT_PALETTES: Record<string, { name: string; full: string; model: string; color: string; hair: string; shirt: string }> = {
  "01_po_analyst": {
    name: "PO",
    full: "Product Owner / Analyst",
    model: "opencode",
    color: "#F39C12",
    hair: "#311432",
    shirt: "#E67E22",
  },
  "02_uiux_designer": {
    name: "UX",
    full: "UI/UX Designer",
    model: "opencode",
    color: "#E91E63",
    hair: "#2C1820",
    shirt: "#D81B60",
  },
  "03_tech_lead_db": {
    name: "TL",
    full: "Tech Lead & DBA",
    model: "opencode",
    color: "#9B59B6",
    hair: "#1B2631",
    shirt: "#8E44AD",
  },
  "04_dev_senior": {
    name: "SR",
    full: "Senior Engineer",
    model: "opencode",
    color: "#2980B9",
    hair: "#2C3E50",
    shirt: "#1F618D",
  },
  "05_dev_junior": {
    name: "JR",
    full: "Junior Developer",
    model: "opencode",
    color: "#1ABC9C",
    hair: "#3E2723",
    shirt: "#16A085",
  },
  "06_qa_tester": {
    name: "QA",
    full: "QA & Code Reviewer",
    model: "opencode",
    color: "#E67E22",
    hair: "#5D4037",
    shirt: "#D35400",
  },
  "07_devops_release": {
    name: "OPS",
    full: "DevOps & SRE",
    model: "opencode",
    color: "#34495E",
    hair: "#17202A",
    shirt: "#2C3E50",
  },
  "08_marketing_copy": {
    name: "MKT",
    full: "Marketing & Tech Writer",
    model: "opencode",
    color: "#16A085",
    hair: "#212F3D",
    shirt: "#117864",
  },
  "ai-crew-orchestrator": {
    name: "ORCH",
    full: "AI-Crew Orchestrator",
    model: "google/gemini-flash-lite-latest",
    color: "#E74C3C",
    hair: "#2C3E50",
    shirt: "#C0392B",
  },
  orchestrator: {
    name: "ORCH",
    full: "AI-Crew Orchestrator",
    model: "google/gemini-flash-lite-latest",
    color: "#E74C3C",
    hair: "#2C3E50",
    shirt: "#C0392B",
  },
};

export const DESK_COORDINATES: Record<string, { x: number; y: number }> = {
  "01_po_analyst": { x: 136, y: 172 },
  "02_uiux_designer": { x: 204, y: 172 },
  "03_tech_lead_db": { x: 204, y: 324 },
  "04_dev_senior": { x: 204, y: 248 },
  "05_dev_junior": { x: 136, y: 248 },
  "06_qa_tester": { x: 136, y: 324 },
  "07_devops_release": { x: 204, y: 400 },
  "08_marketing_copy": { x: 136, y: 400 },
  "ai-crew-orchestrator": { x: 170, y: 110 },
  orchestrator: { x: 170, y: 110 },
};

// Fallback desk coordinates for dynamically discovered agents beyond the 8 default ones
const EXTRA_DESKS = [
  { x: 136, y: 476 },
  { x: 204, y: 476 },
  { x: 72, y: 172 },
  { x: 72, y: 248 },
  { x: 72, y: 324 },
  { x: 72, y: 400 },
];

export function getDeskCoordinates(id: string, index: number) {
  if (DESK_COORDINATES[id]) return DESK_COORDINATES[id];
  return EXTRA_DESKS[index % EXTRA_DESKS.length];
}

export function generateAgentPalette(id: string, def?: { name?: string; description?: string; model?: string }) {
  if (AGENT_PALETTES[id]) return AGENT_PALETTES[id];
  const h = hashString(id) % 360;
  const color = `hsl(${h}, 65%, 55%)`;
  const name = def?.name ? (def.name.length > 4 ? def.name.slice(0, 4).toUpperCase() : def.name.toUpperCase()) : id.slice(0, 4).toUpperCase();
  const full = def?.name || id;
  const model = def?.model || "opencode";
  return {
    name,
    full,
    model,
    color,
    hair: "#2c3e50",
    shirt: color,
  };
}

export const OFFICE_POIS = {
  COFFEE_MACHINE: { x: 790, y: 400, name: "Cafeteira" },
  PLANT_LOUNGE: { x: 72, y: 504, name: "Planta do Lounge" },
  PLANT_CORRIDOR: { x: 506, y: 176, name: "Planta Entrada" },
  LOUNGE_TABLE: { x: 630, y: 318, name: "Mesinha de Centro" },
};

export const SOFA_SLOTS = [
  { x: 596, y: 206 },
  { x: 658, y: 206 },
  { x: 506, y: 264 },
  { x: 506, y: 310 },
  { x: 722, y: 264 },
  { x: 722, y: 310 },
  { x: 596, y: 380 },
  { x: 658, y: 380 },
];

export const ACTION_THOUGHTS = {
  COFFEE: ["Mais café!", "Café puro.", "Abastecendo...", "Quarta xícara.", "Preciso de cafeína."],
  PLANT: ["Samambaia viva!", "Respirando...", "Esticando as costas.", "Postura reta.", "Bela planta."],
  SOFA: ["Descansando 5 min.", "Aguardando task...", "Pensando no bug...", "De boa no sofá.", "Pronto pra próxima."],
};

export const POKE_REACTIONS: Record<string, string[]> = {
  default: ["Oi!", "Tô pronto.", "Opa!", "Trabalhando duro!"],
};

export const PAIRED_CONVERSATIONS = [
  {
    speakerA: "05_dev_junior",
    lineA: "Reescreve em Rust?",
    speakerB: "04_dev_senior",
    lineB: "Nem começa, Júnior...",
  },
  {
    speakerA: "02_uiux_designer",
    lineA: "Faltou 2px de gap.",
    speakerB: "01_po_analyst",
    lineB: "Ninguém repara nisso!",
  },
];
