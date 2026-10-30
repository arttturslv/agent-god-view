/** @format */

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface TauriAgentDef {
  id: string;
  name: string;
  description?: string;
  model?: string;
}

export interface TauriProjectInfo {
  projectId: string;
  name: string;
  path: string;
  agents: TauriAgentDef[];
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getTauriProjectInfo(): Promise<TauriProjectInfo | null> {
  if (!isTauriRuntime()) return null;
  return invoke<TauriProjectInfo>("get_project_info");
}

export async function getTauriSnapshot(projectId: string): Promise<string> {
  if (!isTauriRuntime()) return "";
  return invoke<string>("get_snapshot", { projectId });
}

export async function openPip(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("open_pip");
}

export async function closeCurrentWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  await getCurrentWindow().close();
}

export async function getCurrentWindowLabel(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return getCurrentWindow().label;
}

export async function notifyPermission(
  agentName: string,
  what: string,
): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("notify_permission", { agentName, what });
}

export async function clearPermissionAttention(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("clear_permission_attention");
}
