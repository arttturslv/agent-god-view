/** @format */

import { readFileSync } from "node:fs";
import { emptyState, reduce } from "../packages/core/src/reducer.js";
import { createMapper } from "../packages/adapter-opencode/src/mapper.js";

const mapper = createMapper();
let state = emptyState();

for (const line of readFileSync(process.argv[2], "utf8")
  .split("\n")
  .filter(Boolean)) {
  for (const ev of mapper.mapEvent(line)) {
    state = reduce(state, ev);
    if (ev.type !== "agent_active") {
      console.log(
        new Date(ev.ts).toISOString().slice(11, 19),
        JSON.stringify(ev),
      );
    }
  }
}

console.log("\nEstado final:");
for (const a of Object.values(state.agents)) {
  console.log(" ", a.id, a.status, a.task ?? "");
}
