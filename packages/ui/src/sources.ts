/** @format */

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
