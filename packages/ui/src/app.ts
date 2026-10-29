/** @format */

import {
  CONSTANTS,
  SOFA_SLOTS,
  ACTION_THOUGHTS,
  PAIRED_CONVERSATIONS,
  POKE_REACTIONS,
  BUBBLE_PRIORITY,
  STATUS_LABELS,
  STATUS_BUBBLE_TEMPLATES,
  truncateText,
  getElapsedMinutes,
  formatStatusBubbleText,
  rollIdleAction,
  rollIdleCooldown,
  getWalkSpeed,
  generateAgentPalette,
  getDeskCoordinates,
} from "./constants.js";
import { audio } from "./audio.js";
import { drawOffice, drawOfficeOverlay } from "./office.js";
import {
  loadSnapshot,
  saveSnapshot,
  serializeSnapshot,
} from "./persistence.js";
import { SseSource, PollingSource, StateSource } from "./sources.js";

// Check compact mode for PiP
const isCompact = window.location.search.includes("compact") || window.location.search.includes("mode=compact");
if (isCompact) {
  document.body.classList.add("compact");
}

const canvas = document.getElementById("viewport") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const overlay = document.getElementById("overlay")!;
const container = document.getElementById("canvas-container")!;
const mapStage = document.getElementById("map-stage")!;

const hudProject = document.getElementById("hud-project");
const jsonViewer = document.getElementById("json-content");
const teamList = document.getElementById("team-list");
const permissionBanner = document.getElementById("permission-banner");
const permissionBannerText = document.getElementById("permission-banner-text");
const permissionBannerImpact = document.getElementById("permission-banner-impact");

const ORIGINAL_TITLE = document.title;
const PREFIXED_TITLE = `(1) ${ORIGINAL_TITLE}`;

canvas.width = CONSTANTS.CANVAS_WIDTH;
canvas.height = CONSTANTS.CANVAS_HEIGHT;

let currentProjectId = "default";
let savedSnapshot = loadSnapshot(currentProjectId);

let baseScale = 1;
let displayScale = 1;

function fitCanvasToContainer() {
  baseScale = Math.min(
    container.clientWidth / canvas.width,
    container.clientHeight / canvas.height,
  );
  displayScale = baseScale * camera.zoom;
  const width = canvas.width * displayScale;
  const height = canvas.height * displayScale;
  const stageWidth = Math.max(container.clientWidth, width);
  const stageHeight = Math.max(container.clientHeight, height);
  const left = (stageWidth - width) / 2;
  const top = (stageHeight - height) / 2;
  mapStage.style.width = `${stageWidth}px`;
  mapStage.style.height = `${stageHeight}px`;
  for (const layer of [canvas, overlay]) {
    layer.style.left = `${left}px`;
    layer.style.top = `${top}px`;
    layer.style.width = `${width}px`;
    layer.style.height = `${height}px`;
  }
}

export const camera = { zoom: savedSnapshot?.camera?.zoom ?? 1.0 };

const canvasResizeObserver = new ResizeObserver(fitCanvasToContainer);
canvasResizeObserver.observe(container);
window.addEventListener("resize", fitCanvasToContainer);
fitCanvasToContainer();

if (savedSnapshot?.scroll) {
  requestAnimationFrame(() => {
    const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    container.scrollLeft = Math.min(savedSnapshot.scroll.left, maxLeft);
    container.scrollTop = Math.min(savedSnapshot.scroll.top, maxTop);
  });
}

function updateZoomLabel() {
  const label = document.getElementById("zoom-level");
  if (label) label.textContent = `${Math.round(camera.zoom * 100)}%`;
}

function setZoomAt(nextZoom: number, clientX: number, clientY: number) {
  const zoom = Math.min(
    Math.max(nextZoom, CONSTANTS.ZOOM_MIN),
    CONSTANTS.ZOOM_MAX,
  );
  if (zoom === camera.zoom) return;

  const containerRect = container.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const localX = clientX - containerRect.left;
  const localY = clientY - containerRect.top;
  const mapX = (clientX - canvasRect.left) / displayScale;
  const mapY = (clientY - canvasRect.top) / displayScale;

  camera.zoom = zoom;
  fitCanvasToContainer();
  updateZoomLabel();

  requestAnimationFrame(() => {
    const left = Number.parseFloat(canvas.style.left) || 0;
    const top = Number.parseFloat(canvas.style.top) || 0;
    container.scrollLeft = left + mapX * displayScale - localX;
    container.scrollTop = top + mapY * displayScale - localY;
  });
}

let isDragging = false;
let dragDist = 0;
let lastMouse = { x: 0, y: 0 };
let lastHandoffSignature: string | null = null;
let isConversationActive = false;

export const stateStore = {
  rawJson: {} as any,
  hoveredAgent: null as any,
  mousePos: { x: 0, y: 0 },
};

export const agents: Record<string, any> = {};

function initAgents(agentDefs: Record<string, any>[]) {
  let slot = 0;
  for (const def of agentDefs) {
    const id = def.id;
    if (agents[id]) {
      // update definition if needed
      agents[id].name = def.name || agents[id].name;
      agents[id].full = def.description || def.name || agents[id].full;
      agents[id].model = def.model || agents[id].model;
      continue;
    }

    const palette = generateAgentPalette(id, def);
    const pos = SOFA_SLOTS[slot % SOFA_SLOTS.length];
    const saved = savedSnapshot?.agents?.[id];
    let idleAction = saved?.idleAction ?? "sofa";
    let targetX = saved?.targetX ?? pos.x;
    let targetY = saved?.targetY ?? pos.y;

    if (idleAction === "chatting") {
      idleAction = "sofa";
      targetX = pos.x;
      targetY = pos.y;
    }

    const deskCoord = getDeskCoordinates(id, slot);

    agents[id] = {
      id,
      ...palette,
      desk: deskCoord,
      x: saved?.x ?? pos.x,
      y: saved?.y ?? pos.y,
      targetX,
      targetY,
      moveAxis: saved?.moveAxis ?? "x",
      status: def.status || "idle",
      statusSignature: "idle|",
      statusSince: Date.now(),
      statusTask: def.task || "",
      statusBubbleMinutes: -1,
      permissionPending: false,
      lastIdleAction: null,
      lastPois: [],
      walkSpeed: getWalkSpeed(id),
      idleAction,
      idleCooldown: saved?.idleCooldown ?? rollIdleCooldown(),
      bubble: null,
      bubbleTimer: 0,
      animTick: 0,
      facing: saved?.facing ?? "right",
      jumpOffset: 0,
    };
    slot++;
  }
}

function matchId(raw: string): string | null {
  if (!raw) return null;
  if (agents[raw]) return raw;
  const clean = raw.toLowerCase();
  return (
    Object.keys(agents).find((k) => k.toLowerCase().includes(clean)) || null
  );
}

function setAgentTarget(agent: any, targetX: number, targetY: number, moveAxis?: string) {
  agent.targetX = targetX;
  agent.targetY = targetY;
  if (moveAxis) agent.moveAxis = moveAxis;
  if (targetX !== agent.x) {
    agent.facing = targetX > agent.x ? "right" : "left";
  }
}

function sendAgentToSofa(agent: any, moveAxis = "x") {
  agent.idleAction = "sofa";
  const slotIndex = Object.keys(agents).indexOf(agent.id) % SOFA_SLOTS.length;
  setAgentTarget(
    agent,
    SOFA_SLOTS[slotIndex].x,
    SOFA_SLOTS[slotIndex].y,
    moveAxis,
  );
}

export function applyState(state: any) {
  stateStore.rawJson = state;
  updateJsonViewer(state);

  if (state.agents && typeof state.agents === "object") {
    const defs = Object.values(state.agents);
    if (defs.length > 0) {
      initAgents(defs as any[]);
    }
  }

  for (const [id, agent] of Object.entries(agents)) {
    let currentStatus = "idle";
    let currentTask = "";

    const agentData = state.agents?.[id];
    if (agentData) {
      if (agentData.status) currentStatus = agentData.status;
      if (agentData.task) currentTask = agentData.task;
    }

    if (agent.status !== "idle" && currentStatus === "idle") {
      sendAgentToSofa(agent, Math.random() > 0.5 ? "x" : "y");
    }

    agent.status = currentStatus;
    agent.statusTask = currentTask;

    if (currentStatus !== "idle" && agent.desk) {
      setAgentTarget(agent, agent.desk.x + 8, agent.desk.y + 12, "x");
      agent.idleAction = null;
    }

    const signature = `${currentStatus}|${currentTask}`;
    if (agent.statusSignature !== signature) {
      agent.statusSignature = signature;
      agent.statusSince = Date.now();
      agent.statusBubbleMinutes = -1;
    }
  }

  // Handle pending permissions
  const pendingPerms = state.pendingPermissions || [];
  const hasPending = pendingPerms.length > 0;
  const firstPerm = hasPending ? pendingPerms[0] : null;

  updatePermissionState(firstPerm, hasPending);
  reconcileStatusBubbles();
  applyHandoffEvent(state);

  updatePermissionBanner(firstPerm, hasPending);
  updateDocumentTitle(hasPending);
  renderTeamCards();
}

function updatePermissionState(permission: any, pending: boolean) {
  const what = permission && typeof permission.what === "string" ? permission.what.trim() : "";
  const pendingAgentId = permission ? matchId(permission.agentId) : null;

  if (pending) {
    audio.playAlert();
  }

  const bubbleText = `⚠️ Aprovar: ${truncateText(what || "ação pendente", 44)}`;
  for (const [id, agent] of Object.entries(agents)) {
    const isPending = pending && id === pendingAgentId;
    agent.permissionPending = isPending;

    if (isPending) {
      agent.bubble = {
        text: bubbleText,
        color: "#b45309",
        priority: BUBBLE_PRIORITY.EVENT,
        kind: "permission",
      };
      agent.bubbleTimer = CONSTANTS.PERMISSION_BUBBLE_TICKS;
    } else if (agent.bubble?.kind === "permission") {
      agent.bubble = null;
    }
  }
}

function reconcileStatusBubbles() {
  for (const agent of Object.values(agents)) {
    if (agent.status === "idle") {
      if (agent.bubble?.priority === BUBBLE_PRIORITY.STATUS) {
        agent.bubble = null;
      }
      agent.statusBubbleMinutes = -1;
      continue;
    }

    if (agent.bubble && agent.bubble.priority !== BUBBLE_PRIORITY.STATUS) {
      continue;
    }

    const minutes = getElapsedMinutes(agent.statusSince);
    if (agent.bubble && minutes === agent.statusBubbleMinutes) continue;

    const template = STATUS_BUBBLE_TEMPLATES[agent.status];
    agent.bubble = {
      text: formatStatusBubbleText({
        status: agent.status,
        task: agent.statusTask,
        elapsedMinutes: minutes,
      }),
      color: template?.color || "#334155",
      priority: BUBBLE_PRIORITY.STATUS,
    };
    agent.bubbleTimer = CONSTANTS.STATUS_BUBBLE_TICKS;
    agent.statusBubbleMinutes = minutes;
  }
}

function applyHandoffEvent(state: any) {
  if (!state.lastHandoff || !state.lastHandoff.from || !state.lastHandoff.to) return;
  const h = state.lastHandoff;
  const signature = `${h.from}->${h.to}:${h.ts}`;
  if (signature === lastHandoffSignature) return;

  const from = matchId(h.from);
  const to = matchId(h.to);
  if (!from || !to || !agents[from] || !agents[to]) return;

  lastHandoffSignature = signature;
  audio.playPass();

  agents[from].bubble = {
    text: `✔ HANDOFF`,
    color: "#16a34a",
    priority: BUBBLE_PRIORITY.EVENT,
    kind: "handoff",
  };
  agents[from].bubbleTimer = CONSTANTS.BUBBLE_DURATION;

  agents[to].bubble = {
    text: `RECEBIDO!`,
    color: "#0284c7",
    priority: BUBBLE_PRIORITY.EVENT,
    kind: "handoff",
  };
  agents[to].bubbleTimer = CONSTANTS.BUBBLE_DURATION;
}

function updatePermissionBanner(permission: any, pending: boolean) {
  if (!permissionBanner) return;

  if (!pending || !permission) {
    permissionBanner.hidden = true;
    if (permissionBannerText) permissionBannerText.textContent = "";
    if (permissionBannerImpact) {
      permissionBannerImpact.textContent = "";
      permissionBannerImpact.hidden = true;
    }
    return;
  }

  const agent = agents[matchId(permission.agentId) || ""];
  const name = agent ? `${agent.full} (${agent.name})` : permission.agentId || "Persona";
  const what = permission.what || "ação pendente";

  if (permissionBannerText) {
    permissionBannerText.textContent = `${name} · ${what}`;
  }
  permissionBanner.hidden = false;
}

function updateDocumentTitle(pending: boolean) {
  if (pending) {
    if (document.title !== PREFIXED_TITLE) document.title = PREFIXED_TITLE;
  } else if (document.title !== ORIGINAL_TITLE) {
    document.title = ORIGINAL_TITLE;
  }
}

const CONVERSATION_CHANCE_PER_TICK = 0.07;

function pushRecentPoi(agent: any, poi: string) {
  if (!poi) return;
  agent.lastPois = [poi, ...agent.lastPois].slice(0, 2);
}

function applyIdleAction(agent: any, choice: { action: string; poi: string | null }) {
  const { action, poi } = choice;
  agent.idleAction = action;
  agent.lastIdleAction = action;

  if (action === "coffee") {
    pushRecentPoi(agent, poi!);
    const target = CONSTANTS.OFFICE_POIS?.COFFEE_MACHINE || { x: 790, y: 400 };
    setAgentTarget(agent, target.x - 14, target.y + 16, "y");
    setTimeout(() => {
      if (agent.status === "idle" && agent.idleAction === "coffee") {
        const phrases = ACTION_THOUGHTS.COFFEE;
        agent.bubble = {
          text: phrases[Math.floor(Math.random() * phrases.length)],
          color: "#451a03",
          priority: BUBBLE_PRIORITY.EVENT,
          kind: "coffee",
        };
        agent.bubbleTimer = 180;
      }
    }, 3000);
    return;
  }

  if (action === "plant") {
    const poiName = poi || "PLANT_LOUNGE";
    pushRecentPoi(agent, poiName);
    setAgentTarget(agent, 72, 504, "x");
    setTimeout(() => {
      if (agent.status === "idle" && agent.idleAction === "plant") {
        const phrases = ACTION_THOUGHTS.PLANT;
        agent.bubble = {
          text: phrases[Math.floor(Math.random() * phrases.length)],
          color: "#14532d",
          priority: BUBBLE_PRIORITY.EVENT,
          kind: "plant",
        };
        agent.bubbleTimer = 180;
      }
    }, 3000);
    return;
  }

  sendAgentToSofa(agent, Math.random() > 0.5 ? "x" : "y");
}

function runIdleLifeCycle() {
  const idleAgents = Object.values(agents).filter((a) => a.status === "idle");
  if (idleAgents.length === 0) return;

  idleAgents.forEach((agent) => {
    if (agent.idleAction === "chatting" || agent === stateStore.hoveredAgent)
      return;

    agent.idleCooldown -= 1;
    if (agent.idleCooldown > 0) return;

    agent.idleCooldown = rollIdleCooldown();
    applyIdleAction(
      agent,
      rollIdleAction({
        previousAction: agent.lastIdleAction,
        recentPois: agent.lastPois,
      }),
    );
  });
}
setInterval(runIdleLifeCycle, CONSTANTS.IDLE_CYCLE_TICK_MS);

function updateHoveredAgent(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const screenX = clientX - rect.left;
  const screenY = clientY - rect.top;
  const worldX = screenX / displayScale;
  const worldY = screenY / displayScale;

  stateStore.mousePos = { x: screenX, y: screenY };

  let found = null;
  for (const agent of Object.values(agents)) {
    if (
      worldX >= agent.x - 4 &&
      worldX <= agent.x + 20 &&
      worldY >= agent.y - 4 &&
      worldY <= agent.y + 26
    ) {
      found = agent;
      break;
    }
  }
  stateStore.hoveredAgent = found;
  container.style.cursor = found ? "pointer" : isDragging ? "grabbing" : "grab";
}

function pokeAgent(agent: any) {
  if (!agent) return;
  audio.playPoke();

  agent.jumpOffset = -4;
  setTimeout(() => {
    agent.jumpOffset = 0;
  }, 180);

  const phrases = POKE_REACTIONS[agent.id] || POKE_REACTIONS.default;
  const text = phrases[Math.floor(Math.random() * phrases.length)];

  agent.bubble = {
    text,
    color: agent.color,
    priority: BUBBLE_PRIORITY.EVENT,
    kind: "poke",
  };
  agent.bubbleTimer = 200;
}

container.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  updateHoveredAgent(e.clientX, e.clientY);
  isDragging = true;
  dragDist = 0;
  lastMouse = { x: e.clientX, y: e.clientY };
  container.setPointerCapture(e.pointerId);
});

window.addEventListener("pointermove", (e) => {
  updateHoveredAgent(e.clientX, e.clientY);
  if (!isDragging) return;
  const screenDx = e.clientX - lastMouse.x;
  const screenDy = e.clientY - lastMouse.y;
  dragDist += Math.hypot(screenDx, screenDy);
  lastMouse = { x: e.clientX, y: e.clientY };
  container.scrollLeft -= screenDx;
  container.scrollTop -= screenDy;
});

function stopDragging(e: PointerEvent) {
  updateHoveredAgent(e.clientX, e.clientY);
  if (e.type === "pointerup" && dragDist < 5 && stateStore.hoveredAgent) {
    pokeAgent(stateStore.hoveredAgent);
  }
  isDragging = false;
}

window.addEventListener("pointerup", stopDragging as EventListener);
window.addEventListener("pointercancel", stopDragging as EventListener);

container.addEventListener(
  "wheel",
  (e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoomAt(camera.zoom * factor, e.clientX, e.clientY);
    updateHoveredAgent(e.clientX, e.clientY);
  },
  { passive: false },
);

// Top controls
const btnResetCam = document.getElementById("btn-reset-cam");
if (btnResetCam) {
  btnResetCam.onclick = () => {
    camera.zoom = 1.0;
    fitCanvasToContainer();
    container.scrollLeft = 0;
    container.scrollTop = 0;
    updateZoomLabel();
  };
}
const btnZoomIn = document.getElementById("btn-zoom-in");
if (btnZoomIn) {
  btnZoomIn.onclick = () => {
    const rect = container.getBoundingClientRect();
    setZoomAt(camera.zoom * 1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };
}
const btnZoomOut = document.getElementById("btn-zoom-out");
if (btnZoomOut) {
  btnZoomOut.onclick = () => {
    const rect = container.getBoundingClientRect();
    setZoomAt(camera.zoom / 1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };
}
updateZoomLabel();

const btnSound = document.getElementById("btn-sound");
if (btnSound) {
  btnSound.onclick = () => {
    audio.enabled = !audio.enabled;
    btnSound.innerText = audio.enabled ? "🔊 Som Ativo" : "🔇 Mudo";
  };
}

const drawer = document.getElementById("sim-drawer");
const btnToggleSim = document.getElementById("btn-toggle-sim");
if (btnToggleSim && drawer) {
  btnToggleSim.onclick = () => {
    drawer.classList.toggle("open");
  };
}
const btnCloseDrawer = document.getElementById("btn-close-drawer");
if (btnCloseDrawer && drawer) {
  btnCloseDrawer.onclick = () => {
    drawer.classList.remove("open");
  };
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  (btn as HTMLElement).onclick = () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    const target = (btn as HTMLElement).dataset.target;
    if (target) document.getElementById(target)?.classList.add("active");
  };
});

function updateJsonViewer(json: any) {
  if (jsonViewer) jsonViewer.innerText = JSON.stringify(json, null, 2);
}

function renderTeamCards() {
  if (!teamList) return;

  teamList.innerHTML = Object.values(agents)
    .map((a) => {
      const classes = ["team-card"];
      if (a.status !== "idle") classes.push("active");
      if (a.permissionPending) classes.push("needs-permission");
      const label = STATUS_LABELS[a.status] || STATUS_LABELS.idle;

      return `
    <div class="${classes.join(" ")}">
      <div class="team-card-header">
        <span class="avatar-dot" style="background:${a.color}"></span>
        <div class="team-info">
          <div class="team-name">${a.full} <span class="team-tag">${a.name}</span></div>
          <div class="team-model">${a.model}</div>
        </div>
      </div>
      <div class="team-status-badge status-${a.status}">${label}</div>
    </div>
  `;
    })
    .join("");
}

// Fetch project info to set projectId for persistence
async function initProject() {
  try {
    const res = await fetch("/project");
    if (res.ok) {
      const proj = await res.json();
      if (proj.projectId) {
        currentProjectId = proj.projectId;
        if (hudProject) hudProject.textContent = proj.name || currentProjectId;
        savedSnapshot = loadSnapshot(currentProjectId);
      }
    }
  } catch {
    if (hudProject) hudProject.textContent = "Local";
  }
}

initProject().then(() => {
  // Initialize state source: SseSource with PollingSource fallback
  const source: StateSource = new SseSource("/events");
  source.subscribe((state) => {
    applyState(state);
  });
});

// Persistence
function persistSnapshot() {
  try {
    saveSnapshot(serializeSnapshot({ agents, camera, container }), currentProjectId);
  } catch {}
}

setInterval(persistSnapshot, 1500);
window.addEventListener("pagehide", persistSnapshot);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persistSnapshot();
});

// Animation loop
function loop() {
  drawOffice(ctx, canvas, agents, stateStore.hoveredAgent);
  drawOfficeOverlay(
    overlay,
    displayScale,
    agents,
    stateStore.hoveredAgent,
    stateStore.mousePos,
  );
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
