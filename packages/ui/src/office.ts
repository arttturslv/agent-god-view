/** @format */

import {
  CONSTANTS,
  getAnimOffset,
} from "./constants.js";

let woodPattern: CanvasPattern | null = null;
let carpetPattern: CanvasPattern | null = null;
let brickPattern: CanvasPattern | null = null;
let checkerPattern: CanvasPattern | null = null;
let officeLabels: Array<{ node: HTMLElement; x: number; y: number }> | null = null;
const bubbleNodes = new Map<string, HTMLElement>();
let tooltipNode: HTMLElement | null = null;

function createProceduralPatterns(ctx: CanvasRendering2DContext) {
  if (woodPattern && carpetPattern && brickPattern && checkerPattern) return;

  const bCanvas = document.createElement("canvas");
  bCanvas.width = 32;
  bCanvas.height = 16;
  const bCtx = bCanvas.getContext("2d")!;
  bCtx.fillStyle = "#3a211a";
  bCtx.fillRect(0, 0, 32, 16);
  bCtx.fillStyle = "#6b3a2c";
  bCtx.fillRect(1, 1, 14, 6);
  bCtx.fillStyle = "#7d4635";
  bCtx.fillRect(16, 1, 15, 6);
  bCtx.fillStyle = "#4a271e";
  bCtx.fillRect(1, 9, 7, 6);
  bCtx.fillRect(9, 9, 14, 6);
  bCtx.fillRect(24, 9, 7, 6);
  brickPattern = ctx.createPattern(bCanvas, "repeat");

  const cCanvas = document.createElement("canvas");
  cCanvas.width = 24;
  cCanvas.height = 24;
  const cCtx = cCanvas.getContext("2d")!;
  cCtx.fillStyle = "#27425f";
  cCtx.fillRect(0, 0, 24, 24);
  cCtx.fillStyle = "#2f5278";
  cCtx.fillRect(0, 0, 12, 12);
  cCtx.fillRect(12, 12, 12, 12);
  cCtx.fillStyle = "#1b2d42";
  cCtx.fillRect(0, 11, 24, 1);
  cCtx.fillRect(11, 0, 1, 24);
  carpetPattern = ctx.createPattern(cCanvas, "repeat");

  const chCanvas = document.createElement("canvas");
  chCanvas.width = 32;
  chCanvas.height = 32;
  const chCtx = chCanvas.getContext("2d")!;
  chCtx.fillStyle = "#2b2b30";
  chCtx.fillRect(0, 0, 32, 32);
  chCtx.fillStyle = "#e8e4dc";
  chCtx.fillRect(0, 0, 16, 16);
  chCtx.fillRect(16, 16, 16, 16);
  checkerPattern = ctx.createPattern(chCanvas, "repeat");

  const pCanvas = document.createElement("canvas");
  pCanvas.width = 16;
  pCanvas.height = 16;
  const pCtx = pCanvas.getContext("2d")!;
  pCtx.fillStyle = "#6d452c";
  pCtx.fillRect(0, 0, 16, 16);
  pCtx.fillStyle = "#8a5a3b";
  pCtx.fillRect(0, 0, 16, 8);
  pCtx.fillStyle = "#b07a4f";
  pCtx.fillRect(0, 2, 16, 2);
  pCtx.fillRect(0, 10, 16, 2);
  woodPattern = ctx.createPattern(pCanvas, "repeat");
}

export function drawOffice(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  agents: Record<string, any>,
  hoveredAgent: any,
) {
  createProceduralPatterns(ctx);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = "#0b0f17";
  ctx.fillRect(0, 0, 920, 540);

  ctx.fillStyle = "#0e1420";
  ctx.fillRect(6, 6, 370, 86);
  ctx.fillStyle = brickPattern || "#6b3a2c";
  ctx.fillRect(6, 92, 370, 442);

  ctx.fillStyle = "#151c2c";
  ctx.fillRect(6, 6, 124, 142);
  ctx.fillStyle = "#6d452c";
  ctx.fillRect(80, 86, 44, 58);
  ctx.fillStyle = "#8a5a3b";
  ctx.fillRect(84, 90, 36, 50);
  ctx.fillStyle = "#1a120e";
  ctx.fillRect(114, 112, 3, 6);

  ctx.fillStyle = "#1a120e";
  ctx.fillRect(231, 15, 38, 38);
  ctx.fillStyle = "#e8e4dc";
  ctx.fillRect(232, 16, 36, 36);
  ctx.fillStyle = "#1a120e";
  ctx.fillRect(249, 22, 2, 14);
  ctx.fillRect(242, 33, 10, 2);

  ctx.fillStyle = "#1d6b38";
  ctx.fillRect(346, 12, 24, 80);
  ctx.fillStyle = "#2f8f4e";
  ctx.fillRect(348, 16, 20, 72);
  ctx.fillStyle = "#59c26a";
  ctx.fillRect(352, 22, 12, 60);

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(34, 513, 24, 6);
  ctx.fillStyle = "#a85d38";
  ctx.fillRect(32, 495, 28, 22);
  ctx.fillStyle = "#c5754d";
  ctx.fillRect(30, 493, 32, 3);
  ctx.fillStyle = "#15803d";
  ctx.fillRect(38, 475, 16, 22);
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(30, 480, 10, 16);
  ctx.fillRect(48, 480, 10, 16);

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(154, 488, 74, 8);
  ctx.fillStyle = "#6d452c";
  ctx.fillRect(152, 170, 78, 320);
  ctx.fillStyle = "#8a5a3b";
  ctx.fillRect(154, 172, 74, 316);
  ctx.fillStyle = "#b07a4f";
  ctx.fillRect(154, 172, 74, 4);
  ctx.fillStyle = "#1a120e";
  ctx.fillRect(188, 178, 6, 304);

  const chairPositionsLeft = [
    { x: 116, y: 190 }, { x: 116, y: 266 }, { x: 116, y: 342 }, { x: 116, y: 418 }
  ];
  const chairPositionsRight = [
    { x: 242, y: 190 }, { x: 242, y: 266 }, { x: 242, y: 342 }, { x: 242, y: 418 }
  ];
  const crtPositionsLeft = [
    { x: 156, y: 192 }, { x: 156, y: 268 }, { x: 156, y: 344 }, { x: 156, y: 420 }
  ];
  const crtPositionsRight = [
    { x: 204, y: 192 }, { x: 204, y: 268 }, { x: 204, y: 344 }, { x: 204, y: 420 }
  ];

  const agentList = Object.values(agents);
  for (let i = 0; i < 4; i++) {
    drawTableChair(ctx, chairPositionsLeft[i].x, chairPositionsLeft[i].y, "right");
    const agentLeft = agentList[i];
    drawCRTMonitor(ctx, crtPositionsLeft[i].x, crtPositionsLeft[i].y, agentLeft, "right");

    drawTableChair(ctx, chairPositionsRight[i].x, chairPositionsRight[i].y, "left");
    const agentRight = agentList[i + 4];
    drawCRTMonitor(ctx, crtPositionsRight[i].x, crtPositionsRight[i].y, agentRight, "left");
  }

  ctx.fillStyle = "#1a120e";
  ctx.fillRect(376, 6, 2, 528);
  ctx.fillRect(390, 6, 2, 528);
  ctx.fillStyle = "#0b0f17";
  ctx.fillRect(378, 6, 12, 528);

  const currentHour = new Date().getHours();
  const isNight = currentHour < 6 || currentHour >= 18;

  if (isNight) {
    ctx.fillStyle = "#090d16";
    ctx.fillRect(392, 12, 514, 140);
    const starTick = Math.floor(Date.now() / 300);
    const stars = [
      { x: 420, y: 30, s: 2, phase: 0 },
      { x: 460, y: 70, s: 1.5, phase: 1 },
      { x: 510, y: 25, s: 2, phase: 2 },
      { x: 550, y: 90, s: 1, phase: 3 },
      { x: 620, y: 35, s: 2, phase: 1 },
      { x: 670, y: 75, s: 1.5, phase: 4 },
      { x: 740, y: 28, s: 2.5, phase: 2 },
      { x: 810, y: 65, s: 1, phase: 3 },
      { x: 860, y: 40, s: 2, phase: 0 },
      { x: 880, y: 100, s: 1.5, phase: 5 },
    ];
    for (const star of stars) {
      const alpha = ((Math.sin(starTick + star.phase) + 1) / 2) * 0.7 + 0.3;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
      ctx.fillRect(star.x, star.y, star.s, star.s);
    }
  } else {
    ctx.fillStyle = "#141b2d";
    ctx.fillRect(392, 12, 514, 140);
    const birdTime = Date.now() / 1000;
    const birdX1 = 392 + ((birdTime * 25) % 550);
    const birdY1 = 40 + Math.sin(birdTime * 3) * 8;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(birdX1, birdY1, 2, 2);
    ctx.fillRect(birdX1 - 2, birdY1 - 2, 2, 2);
    ctx.fillRect(birdX1 + 2, birdY1 - 2, 2, 2);
  }

  ctx.fillStyle = "#1d2739";
  ctx.fillRect(420, 40, 60, 112);
  ctx.fillRect(500, 30, 80, 122);
  ctx.fillRect(600, 50, 70, 102);
  ctx.fillRect(700, 25, 90, 127);
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(430, 50, 8, 12);
  ctx.fillRect(520, 40, 12, 16);
  ctx.fillRect(620, 60, 10, 14);
  ctx.fillRect(720, 35, 12, 16);

  ctx.fillStyle = "#6d452c";
  ctx.fillRect(392, 138, 514, 14);
  ctx.fillStyle = "#8a5a3b";
  ctx.fillRect(392, 138, 514, 4);
  ctx.fillStyle = "#1a120e";
  for (let bx = 402; bx < 896; bx += 20) {
    ctx.fillRect(bx, 124, 3, 16);
  }
  ctx.fillRect(392, 128, 514, 3);

  ctx.fillStyle = carpetPattern || "#27425f";
  ctx.fillRect(392, 152, 522, 382);

  ctx.fillStyle = checkerPattern || "#2b2b30";
  ctx.fillRect(392, 424, 402, 110);

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(792, 526, 124, 6);
  ctx.fillStyle = "#3a251d";
  ctx.fillRect(826, 330, 88, 82);
  ctx.fillStyle = "#7a4a2e";
  ctx.fillRect(830, 334, 80, 74);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(838, 345, 6, 16);
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(848, 343, 6, 18);
  ctx.fillStyle = "#eab308";
  ctx.fillRect(860, 346, 6, 15);

  ctx.fillStyle = "#64748b";
  ctx.fillRect(840, 356, 60, 28);
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(844, 350, 52, 8);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(850, 362, 16, 14);

  ctx.fillStyle = "#7a4a2e";
  ctx.fillRect(790, 412, 124, 122);
  ctx.fillStyle = "#b98a5c";
  ctx.fillRect(790, 412, 124, 6);
  ctx.fillRect(790, 412, 6, 122);
  ctx.fillRect(908, 412, 6, 122);
  ctx.fillStyle = "#5c331d";
  ctx.fillRect(802, 426, 100, 96);

  const stoolY = [430, 466, 502];
  for (const sy of stoolY) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(764, sy + 20, 18, 6);
    ctx.fillStyle = "#1a120e";
    ctx.fillRect(770, sy + 6, 6, 16);
    ctx.fillStyle = "#b98a5c";
    ctx.fillRect(762, sy, 22, 8);
  }

  drawBookshelf(ctx, 402, 160, 74, 60);
  drawBookshelf(ctx, 402, 226, 74, 60);
  drawTallPlant(ctx, 402, 296, 26, 60);
  drawTallPlant(ctx, 876, 152, 26, 58);

  ctx.fillStyle = "#27425f";
  ctx.fillRect(500, 182, 276, 248);
  ctx.fillStyle = "#1e3a5f";
  ctx.fillRect(502, 184, 272, 244);

  drawSofaHorizontal(ctx, 568, 196, 140, 44, "down");
  drawSofaVertical(ctx, 512, 254, 44, 100, "right");
  drawSofaVertical(ctx, 716, 254, 44, 100, "left");
  drawSofaHorizontal(ctx, 568, 372, 140, 44, "up");
  drawCoffeeTableNew(ctx, 596, 292, 84, 52);

  for (const agent of agentList) {
    updateAgentPhysics(agent);
    drawDetailedAgent(ctx, agent, agent === hoveredAgent);
  }

  ctx.restore();
}

export function drawOfficeOverlay(
  overlay: HTMLElement,
  displayScale: number,
  agents: Record<string, any>,
  hoveredAgent: any,
  mousePos: { x: number; y: number },
) {
  const width = overlay.clientWidth;
  const height = overlay.clientHeight;
  ensureOfficeLabels(overlay, displayScale, agents);
  if (officeLabels) {
    for (const { node, x, y } of officeLabels) {
      const halfWidth = node.offsetWidth / 2;
      const halfHeight = node.offsetHeight / 2;
      node.style.left = `${Math.max(halfWidth + 4, Math.min(x * displayScale, width - halfWidth - 4))}px`;
      node.style.top = `${Math.max(halfHeight + 4, Math.min(y * displayScale, height - halfHeight - 4))}px`;
    }
  }
  drawBubblesWithAntiCollision(
    overlay,
    Object.values(agents),
    displayScale,
    width,
    height,
  );
  drawAgentTooltip(overlay, hoveredAgent, mousePos, width, height);
}

function updateAgentPhysics(agent: any) {
  const speed = agent.walkSpeed || CONSTANTS.WALK_SPEED;
  const dx = agent.targetX - agent.x;
  const dy = agent.targetY - agent.y;

  let isWalking = false;

  if (agent.moveAxis === "x") {
    if (Math.abs(dx) > speed) {
      agent.x += Math.sign(dx) * speed;
      agent.facing = dx > 0 ? "right" : "left";
      isWalking = true;
    } else {
      agent.x = agent.targetX;
      if (Math.abs(dy) > speed) {
        agent.y += Math.sign(dy) * speed;
        isWalking = true;
      } else {
        agent.y = agent.targetY;
      }
    }
  } else {
    if (Math.abs(dy) > speed) {
      agent.y += Math.sign(dy) * speed;
      isWalking = true;
    } else {
      agent.y = agent.targetY;
      if (Math.abs(dx) > speed) {
        agent.x += Math.sign(dx) * speed;
        agent.facing = dx > 0 ? "right" : "left";
        isWalking = true;
      } else {
        agent.x = agent.targetX;
      }
    }
  }

  agent.isWalking = isWalking;
  agent.animTick++;
}

function isAtTarget(agent: any): boolean {
  return agent.x === agent.targetX && agent.y === agent.targetY;
}

function ensureOfficeLabels(overlay: HTMLElement, displayScale: number, agents: Record<string, any>) {
  if (officeLabels) {
    // update or re-render labels if agent count changes
    officeLabels.forEach(l => l.node.remove());
  }

  officeLabels = [];
  const addLabel = (text: string, x: number, y: number, className = "") => {
    const label = document.createElement("div");
    label.className = `map-label ${className}`.trim();
    label.textContent = text;
    label.style.left = `${x * displayScale}px`;
    label.style.top = `${y * displayScale}px`;
    overlay.append(label);
    officeLabels!.push({ node: label, x, y });
  };

  for (const agent of Object.values(agents)) {
    if (agent.desk) {
      addLabel(agent.name, agent.desk.x, agent.desk.y, "agent-label");
    }
  }
}

function drawBubblesWithAntiCollision(
  overlay: HTMLElement,
  agentList: any[],
  displayScale: number,
  width: number,
  height: number,
) {
  const activeBubbles = agentList.filter((a) => a.bubble && a.bubbleTimer > 0);
  const renderedBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];

  for (const [id, node] of bubbleNodes) {
    if (!activeBubbles.some((agent) => agent.id === id)) {
      node.remove();
      bubbleNodes.delete(id);
    }
  }

  activeBubbles.forEach((agent) => {
    let node = bubbleNodes.get(agent.id);
    if (!node) {
      node = document.createElement("div");
      node.className = "map-bubble";
      node.tabIndex = 0;
      node.setAttribute("role", "status");
      node.addEventListener("wheel", (event) => event.stopPropagation(), {
        passive: true,
      });

      let touchScrollStart: { clientY: number; scrollTop: number } | null = null;
      node.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        if (event.pointerType === "mouse") return;
        node.focus({ preventScroll: true });
        touchScrollStart = {
          clientY: event.clientY,
          scrollTop: node.scrollTop,
        };
        node.setPointerCapture(event.pointerId);
      });
      node.addEventListener("pointermove", (event) => {
        event.stopPropagation();
        if (touchScrollStart) {
          node.scrollTop =
            touchScrollStart.scrollTop +
            touchScrollStart.clientY -
            event.clientY;
        }
      });
      for (const eventName of ["pointerup", "pointercancel"]) {
        node.addEventListener(eventName, (event) => {
          event.stopPropagation();
          touchScrollStart = null;
        });
      }

      overlay.append(node);
      bubbleNodes.set(agent.id, node);
    }
    if (!node.matches(":hover, :focus")) agent.bubbleTimer--;

    const text = agent.bubble.text || "...";
    if (node.textContent !== text) node.textContent = text;
    node.style.backgroundColor = agent.bubble.color || "#1e293b";
    node.style.maxWidth = `${Math.max(40, Math.min(320, width - 16))}px`;

    const anchorX = (agent.x + 8) * displayScale;
    const anchorY = agent.y * displayScale;
    const bubbleWidth = node.offsetWidth;
    const bubbleHeight = node.offsetHeight;
    let bx = Math.max(
      4,
      Math.min(anchorX - bubbleWidth / 2, width - bubbleWidth - 4),
    );
    let by = anchorY - bubbleHeight - 8;
    if (by < 4) by = anchorY + 10;

    for (const box of renderedBoxes) {
      const overlapX =
        bx < box.x + box.w + 6 && bx + bubbleWidth + 6 > box.x;
      const overlapY =
        by < box.y + box.h + 4 && by + bubbleHeight + 4 > box.y;
      if (overlapX && overlapY) {
        const above = box.y - bubbleHeight - 6;
        by = above >= 4 ? above : box.y + box.h + 6;
      }
    }

    by = Math.max(4, Math.min(by, height - bubbleHeight - 4));
    renderedBoxes.push({ x: bx, y: by, w: bubbleWidth, h: bubbleHeight });
    node.style.left = `${bx}px`;
    node.style.top = `${by}px`;

    if (agent.bubbleTimer <= 0) agent.bubble = null;
  });
}

function drawAgentTooltip(
  overlay: HTMLElement,
  agent: any,
  mousePos: { x: number; y: number },
  width: number,
  height: number,
) {
  if (!agent || !mousePos) {
    tooltipNode?.remove();
    tooltipNode = null;
    return;
  }

  if (!tooltipNode) {
    tooltipNode = document.createElement("div");
    tooltipNode.className = "map-tooltip";
    overlay.append(tooltipNode);
  }

  tooltipNode.innerHTML = "";
  const name = document.createElement("strong");
  name.textContent = `${agent.full} (${agent.name})`;
  const details = document.createElement("span");
  details.textContent = `IA: ${agent.model} · Status: ${agent.status.toUpperCase()}`;
  tooltipNode.append(name, details);
  tooltipNode.style.maxWidth = `${Math.max(40, Math.min(360, width - 16))}px`;

  const tooltipWidth = tooltipNode.offsetWidth;
  const tooltipHeight = tooltipNode.offsetHeight;
  const left = Math.max(
    4,
    Math.min(mousePos.x + 14, width - tooltipWidth - 4),
  );
  const top = Math.max(
    4,
    Math.min(mousePos.y - tooltipHeight - 10, height - tooltipHeight - 4),
  );
  tooltipNode.style.borderColor = agent.color;
  tooltipNode.style.left = `${left}px`;
  tooltipNode.style.top = `${top}px`;
}

function drawDetailedAgent(ctx: CanvasRenderingContext2D, agent: any, isHovered: boolean) {
  const px = Math.round(agent.x);
  const tick = agent.animTick + getAnimOffset(agent.id);
  const walkBob = agent.isWalking
    ? Math.floor(agent.animTick / 6) % 2 === 0
      ? -1
      : 0
    : 0;
  const isSitting = agent.idleAction === "sofa" && isAtTarget(agent);
  const idleBob =
    agent.status === "idle" &&
    !agent.isWalking &&
    !isSitting &&
    Math.floor(tick / 30) % 2 === 0
      ? -1
      : 0;
  const py = Math.round(agent.y) + walkBob + idleBob;

  if (isHovered) {
    ctx.strokeStyle = "#82B965";
    ctx.lineWidth = 1;
    ctx.strokeRect(px - 1, py - 1, 18, 26);
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.fillRect(px + 1, py + 22 - walkBob - idleBob, 14, 5);

  ctx.fillStyle = "#fcd3a1";
  ctx.fillRect(px + 3, py + 2, 10, 10);
  ctx.fillStyle = "#e0b080";
  ctx.fillRect(px + 4, py + 11, 8, 2);

  ctx.fillStyle = agent.hair || "#2c3e50";
  ctx.fillRect(px + 2, py, 12, 4);
  ctx.fillRect(px + 2, py + 4, 3, 5);
  ctx.fillRect(px + 11, py + 4, 3, 5);

  const eyeOffset = agent.facing === "left" ? -1 : 1;
  const isBlinking = tick % 240 < 6;
  ctx.fillStyle = "#1e293b";
  if (isBlinking) {
    ctx.fillRect(px + 5 + eyeOffset, py + 7, 2, 1);
    ctx.fillRect(px + 9 + eyeOffset, py + 7, 2, 1);
  } else {
    ctx.fillRect(px + 5 + eyeOffset, py + 6, 2, 2);
    ctx.fillRect(px + 9 + eyeOffset, py + 6, 2, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(px + 5 + eyeOffset, py + 6, 1, 1);
    ctx.fillRect(px + 9 + eyeOffset, py + 6, 1, 1);
  }

  ctx.fillStyle = agent.shirt || agent.color;
  ctx.fillRect(px + 2, py + 12, 12, 7);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(px + 6, py + 12, 4, 3);
  ctx.fillStyle = "#111827";
  ctx.fillRect(px + 7, py + 14, 2, 4);

  if (agent.status === "working") {
    const isTick = Math.floor(agent.animTick / 8) % 2 === 0;
    ctx.fillStyle = agent.shirt;
    ctx.fillRect(px, py + 13, 2, 4);
    ctx.fillRect(px + 14, py + 13, 2, 4);
    ctx.fillStyle = "#fcd3a1";
    ctx.fillRect(px + 1, isTick ? py + 16 : py + 15, 3, 2);
    ctx.fillRect(px + 12, isTick ? py + 15 : py + 16, 3, 2);
  } else if (agent.isWalking) {
    const armSwing = Math.floor(agent.animTick / 6) % 2 === 0;
    ctx.fillStyle = agent.shirt;
    ctx.fillRect(px + 1, armSwing ? py + 12 : py + 14, 2, 5);
    ctx.fillRect(px + 13, armSwing ? py + 14 : py + 12, 2, 5);
  } else if (agent.idleAction === "coffee" && isAtTarget(agent)) {
    const isSipping = Math.floor(tick / 40) % 2 === 0;
    ctx.fillStyle = agent.shirt;
    ctx.fillRect(px + 1, py + 13, 2, 6);
    ctx.fillRect(px + 13, py + 13, 2, 6);
    ctx.fillStyle = "#fcd3a1";
    if (isSipping) {
      ctx.fillRect(px + 13, py + 10, 2, 3);
      ctx.fillStyle = "#f3eee2";
      ctx.fillRect(px + 12, py + 8, 3, 2);
    } else {
      ctx.fillRect(px + 1, py + 18, 2, 2);
      ctx.fillRect(px + 13, py + 18, 2, 2);
    }
  } else {
    ctx.fillStyle = agent.shirt;
    ctx.fillRect(px + 1, py + 13, 2, 6);
    ctx.fillRect(px + 13, py + 13, 2, 6);
    ctx.fillStyle = "#fcd3a1";
    ctx.fillRect(px + 1, py + 18, 2, 2);
    ctx.fillRect(px + 13, py + 18, 2, 2);
  }

  if (isSitting) {
    ctx.fillStyle = "#1e242c";
    ctx.fillRect(px + 4, py + 20, 8, 3);
    ctx.fillStyle = "#090c10";
    ctx.fillRect(px + 11, py + 20, 4, 2);
  } else {
    ctx.fillStyle = "#1e242c";
    ctx.fillRect(px + 4, py + 19, 3, 4);
    ctx.fillRect(px + 9, py + 19, 3, 4);
    ctx.fillStyle = "#090c10";
    const stepLeft = agent.isWalking && Math.floor(agent.animTick / 6) % 2 === 0;
    ctx.fillRect(px + 3, py + 22 + (stepLeft ? -1 : 0), 4, 2);
    ctx.fillRect(px + 9, py + 22 + (stepLeft ? 0 : -1), 4, 2);
  }

  if (agent.status === "reading") drawPixelBook(ctx, px + 5, py - 9);
  else if (agent.status === "waiting") drawPixelHourglass(ctx, px + 6, py - 9);
  else if (agent.status === "requesting_permission" || agent.status === "waiting_permission")
    drawPixelWarning(ctx, px + 5, py - 9);

  if (agent.permissionPending) {
    const pulse = Math.floor(tick / 20) % 2 === 0;
    ctx.strokeStyle = pulse ? "#f59e0b" : "#b45309";
    ctx.lineWidth = 1;
    ctx.strokeRect(px - 2, py - 2, 20, 28);
  }
}

function drawTableChair(ctx: CanvasRenderingContext2D, x: number, y: number, facing: string) {
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x + 2, y + 24, 20, 6);
  ctx.fillStyle = "#334155";
  ctx.fillRect(x + 4, y + 6, 16, 18);
  ctx.fillStyle = "#475569";
  ctx.fillRect(x + 6, y + 8, 12, 14);
  if (facing === "right") {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(x, y + 4, 5, 22);
  } else {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(x + 19, y + 4, 5, 22);
  }
}

function drawCRTMonitor(ctx: CanvasRenderingContext2D, x: number, y: number, agent: any, facing: string) {
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x + 2, y + 22, 18, 5);
  ctx.fillStyle = "#334155";
  ctx.fillRect(x + 8, y + 16, 6, 8);
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(x, y, 22, 18);

  const isWorking = agent && agent.status === "working";
  let screenColor = "#05070a";
  if (isWorking) screenColor = "#153a20";
  else if (agent && agent.status === "reading") screenColor = "#0c2840";
  else if (agent && agent.status === "waiting") screenColor = "#3d2e05";
  else if (agent && (agent.status === "requesting_permission" || agent.status === "waiting_permission")) {
    screenColor = Math.floor(Date.now() / 250) % 2 === 0 ? "#5c1818" : "#05070a";
  }

  ctx.fillStyle = screenColor;
  ctx.fillRect(x + 2, y + 2, 18, 12);

  if (isWorking) {
    ctx.fillStyle = "#82B965";
    ctx.fillRect(x + 4, y + 4, 10, 1);
    ctx.fillRect(x + 4, y + 6, 12, 1);
  }

  ctx.fillStyle = "#475569";
  if (facing === "right") {
    ctx.fillRect(x + 24, y + 4, 10, 8);
    ctx.fillStyle = "#f3eee2";
    ctx.fillRect(x + 24, y + 16, 4, 4);
  } else {
    ctx.fillRect(x - 12, y + 4, 10, 8);
    ctx.fillStyle = "#f3eee2";
    ctx.fillRect(x - 6, y + 16, 4, 4);
  }
}

function drawBookshelf(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x + 2, y + h - 4, w - 4, 6);
  ctx.fillStyle = "#4a2818";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#6d452c";
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = "#331a0e";
  ctx.fillRect(x + 2, y + 20, w - 4, 3);
  ctx.fillRect(x + 2, y + 40, w - 4, 3);

  const bookColors = ["#ef4444", "#3b82f6", "#eab308", "#22c55e", "#a855f7", "#ec4899"];
  for (let bx = x + 6; bx < x + w - 6; bx += 8) {
    ctx.fillStyle = bookColors[(bx + y) % bookColors.length];
    ctx.fillRect(bx, y + 6, 6, 14);
    ctx.fillStyle = bookColors[(bx * 3) % bookColors.length];
    ctx.fillRect(bx, y + 26, 6, 14);
  }
}

function drawTallPlant(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x + 2, y + h - 6, w - 4, 6);
  ctx.fillStyle = "#a85d38";
  ctx.fillRect(x + 3, y + h - 20, w - 6, 16);
  ctx.fillStyle = "#15803d";
  ctx.fillRect(x + 2, y + 4, w - 4, h - 22);
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(x, y + 10, w, h - 30);
  ctx.fillStyle = "#4ade80";
  ctx.fillRect(x + 4, y, w - 8, 14);
}

function drawSofaHorizontal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, facing: string) {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(x + 4, y + h - 2, w - 8, 6);
  ctx.fillStyle = "#8c1646";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#b3225c";
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

  const count = 4;
  const cw = (w - 16) / count;
  for (let i = 0; i < count; i++) {
    const cx = x + 8 + i * cw;
    ctx.fillStyle = "#c72d6d";
    ctx.fillRect(cx, y + 6, cw - 4, h - 12);
  }

  ctx.fillStyle = "#75123a";
  if (facing === "down") {
    ctx.fillRect(x, y, w, 8);
  } else {
    ctx.fillRect(x, y + h - 8, w, 8);
  }
}

function drawSofaVertical(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, facing: string) {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(x + 4, y + h - 2, w - 4, 6);
  ctx.fillStyle = "#8c1646";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#b3225c";
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

  const count = 3;
  const ch = (h - 16) / count;
  for (let i = 0; i < count; i++) {
    const cy = y + 8 + i * ch;
    ctx.fillStyle = "#c72d6d";
    ctx.fillRect(x + 6, cy, w - 12, ch - 4);
  }

  ctx.fillStyle = "#75123a";
  if (facing === "right") {
    ctx.fillRect(x, y, 8, h);
  } else {
    ctx.fillRect(x + w - 8, y, 8, h);
  }
}

function drawCoffeeTableNew(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x + 4, y + h - 4, w - 8, 6);
  ctx.fillStyle = "#34251d";
  ctx.fillRect(x + 6, y + 6, 4, h - 12);
  ctx.fillRect(x + w - 10, y + 6, 4, h - 12);
  ctx.fillStyle = "#6b4935";
  ctx.fillRect(x, y, w, 16);
  ctx.fillStyle = "#9a6b4c";
  ctx.fillRect(x + 3, y + 2, w - 6, 4);

  ctx.fillStyle = "#f3eee2";
  ctx.fillRect(x + 12, y + 6, 6, 6);
  ctx.fillRect(x + 24, y + 8, 6, 6);

  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(x + 42, y + 4, 12, 10);
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(x + 64, y + 4, 10, 8);
}

function drawPixelBook(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#0284c7";
  ctx.fillRect(x - 1, y - 1, 9, 8);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, 7, 6);
  ctx.fillStyle = "#64748b";
  ctx.fillRect(x + 3, y, 1, 6);
}

function drawPixelHourglass(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(x, y, 6, 1);
  ctx.fillRect(x + 1, y + 1, 4, 1);
  ctx.fillRect(x + 2, y + 2, 2, 2);
  ctx.fillRect(x + 1, y + 4, 4, 1);
  ctx.fillRect(x, y + 5, 6, 1);
}

function drawPixelWarning(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const blink = Math.floor(Date.now() / 200) % 2 === 0;
  ctx.fillStyle = blink ? "#ef4444" : "#b91c1c";
  ctx.fillRect(x + 3, y - 1, 2, 2);
  ctx.fillRect(x + 1, y + 1, 6, 4);
  ctx.fillRect(x, y + 5, 8, 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + 3, y + 1, 2, 3);
  ctx.fillRect(x + 3, y + 5, 2, 1);
}
