/** @format */

import { listen } from "@tauri-apps/api/event";
import { createMapper } from "@agent-god-view/adapter-opencode/mapper";
import {
  emptyState,
  reduce,
  type CrewState as CoreCrewState,
} from "@agent-god-view/core";
import {
  getTauriProjectInfo,
  getTauriSnapshot,
  isTauriRuntime,
} from "./tauri.js";

export interface CrewState {
  agents: Record<string, any>;
  pendingPermissions?: any[];
  lastHandoff?: any;
  updatedAt?: number;
  projectId?: string;
  active_persona?: string;
  personas?: Record<string, any>;
  permission_request?: any;
  handoff?: any;
}

export interface StateSource {
  subscribe(cb: (s: CrewState) => void): () => void;
}

export class SseSource implements StateSource {
  private url: string;
  private eventSource: EventSource | null = null;

  constructor(url = "/events") {
    this.url = url;
  }

  subscribe(cb: (s: CrewState) => void): () => void {
    try {
      this.eventSource = new EventSource(this.url);
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          cb(data);
        } catch (e) {
          console.error("[SseSource] Error parsing SSE message:", e);
        }
      };
      this.eventSource.onerror = (err) => {
        // Will auto-reconnect via EventSource native behavior
      };
    } catch (e) {
      console.error("[SseSource] Failed to open EventSource:", e);
    }

    return () => {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
    };
  }
}

export class PollingSource implements StateSource {
  private url: string;
  private intervalMs: number;
  private timer: any = null;

  constructor(url = "/context/crew_state.json", intervalMs = 1000) {
    this.url = url;
    this.intervalMs = intervalMs;
  }

  subscribe(cb: (s: CrewState) => void): () => void {
    const fetchState = async () => {
      try {
        const res = await fetch(`${this.url}?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          cb(data);
        }
      } catch {}
    };

    fetchState();
    this.timer = setInterval(fetchState, this.intervalMs);

    return () => {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }
}

export class ReplaySource implements StateSource {
  private events: any[];
  private speed: number;
  private timer: any = null;

  constructor(events: any[] = [], speed = 1) {
    this.events = events;
    this.speed = speed;
  }

  subscribe(cb: (s: CrewState) => void): () => void {
    let index = 0;
    const playNext = () => {
      if (index < this.events.length) {
        const ev = this.events[index++];
        cb(ev);
        this.timer = setTimeout(playNext, 1000 / this.speed);
      }
    };
    playNext();

    return () => {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    };
  }
}

interface SpoolLinePayload {
  projectId: string;
  line: string;
  offset: number;
}

const textEncoder = new TextEncoder();

function byteLength(value: string): number {
  return textEncoder.encode(value).length;
}

function snapshotByteOffset(content: string): number {
  const lastNewline = content.lastIndexOf("\n");
  return lastNewline < 0 ? 0 : byteLength(content.slice(0, lastNewline + 1));
}

function applyLine(
  state: CoreCrewState,
  line: string,
  mapper: ReturnType<typeof createMapper>,
): CoreCrewState {
  const clean = line.endsWith("\r") ? line.slice(0, -1) : line;
  if (!clean) return state;

  let next = state;
  for (const event of mapper.mapEvent(clean)) {
    next = reduce(next, event);
  }
  return next;
}

export class TauriEventSource implements StateSource {
  subscribe(cb: (s: CrewState) => void): () => void {
    if (!isTauriRuntime()) return () => {};

    let cancelled = false;
    let unlisten: (() => void) | null = null;
    let snapshotReady = false;
    let buffered: SpoolLinePayload[] = [];
    let snapshotOffset = 0;
    let projectId = "";

    const mapper = createMapper();
    let state = emptyState();

    const publish = () => {
      cb({ ...state, projectId });
    };

    const apply = (payload: SpoolLinePayload) => {
      if (!payload || payload.projectId !== projectId) return;
      if (payload.offset < snapshotOffset) return;
      state = applyLine(state, payload.line, mapper);
      state.projectId = projectId;
      publish();
    };

    void (async () => {
      const project = await getTauriProjectInfo();
      if (!project || cancelled) return;

      projectId = project.projectId;
      state = reduce(state, {
        type: "agents_defined",
        ts: Date.now(),
        agents: project.agents,
      });
      state.projectId = projectId;

      unlisten = await listen<SpoolLinePayload>("spool-line", (event) => {
        if (cancelled) return;
        const payload = event.payload;
        if (!payload) return;
        if (!snapshotReady) {
          buffered.push(payload);
          return;
        }
        apply(payload);
      });

      if (cancelled) {
        unlisten?.();
        return;
      }

      let snapshot = "";
      try {
        snapshot = await getTauriSnapshot(projectId);
      } catch (error) {
        console.error("[TauriEventSource] Failed to read snapshot:", error);
      }
      if (cancelled) return;

      snapshotOffset = snapshotByteOffset(snapshot);

      const lines = snapshot.split("\n");
      lines.pop();
      for (const line of lines) {
        state = applyLine(state, line, mapper);
      }
      state.projectId = projectId;
      publish();

      snapshotReady = true;
      const pending = buffered;
      buffered = [];
      for (const payload of pending) {
        apply(payload);
      }
    })().catch((error) => {
      console.error("[TauriEventSource] Failed to initialize:", error);
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }
}
