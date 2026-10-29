/** @format */

import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Plugin } from "@opencode-ai/plugin";

const pick = (o: any, keys: string[]) =>
  Object.fromEntries(
    keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]),
  );

// undefined/null = descartar o evento
const sanitize = (type: string, p: any): unknown => {
  switch (type) {
    case "session.created":
    case "session.updated":
      return { info: pick(p?.info, ["id", "parentID", "title", "directory"]) };
    case "session.status":
    case "session.idle":
    case "session.error":
      return pick(p, ["sessionID", "status"]);
    case "message.updated":
      return {
        info: pick(p?.info, [
          "id",
          "sessionID",
          "role",
          "agent",
          "mode",
          "modelID",
          "parentID",
        ]),
      };
    case "message.part.updated": {
      if (p?.part?.type !== "tool") return null;
      return {
        part: {
          ...pick(p.part, [
            "id",
            "messageID",
            "sessionID",
            "type",
            "tool",
            "callID",
          ]),
          state: pick(p.part.state, ["status"]),
        },
      };
    }
    case "permission.asked":
    case "permission.updated":
    case "permission.replied":
      return p; // cru por enquanto, para descobrirmos o formato
    default:
      return null;
  }
};

export const AgentGodView: Plugin = async ({ directory }) => {
  const projectId = createHash("sha1")
    .update(directory)
    .digest("hex")
    .slice(0, 12);
  const base = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
  const spoolDir = join(base, "agent-god-view", "spool");
  const spoolFile = join(spoolDir, projectId + ".ndjson");

  const write = (type: string, data: unknown) => {
    try {
      mkdirSync(spoolDir, { recursive: true });
      appendFileSync(
        spoolFile,
        JSON.stringify({ ts: Date.now(), type, data }) + "\n",
      );
    } catch {}
  };

  write("plugin_loaded", { directory });

  return {
    event: async ({ event }) => {
      const data = sanitize(event.type, event.properties);
      if (data != null) write(event.type, data);
    },
    "tool.execute.before": async (input) =>
      write(
        "tool.execute.before",
        pick(input, ["tool", "sessionID", "callID"]),
      ),
    "tool.execute.after": async (input) =>
      write("tool.execute.after", pick(input, ["tool", "sessionID", "callID"])),
  };
};
