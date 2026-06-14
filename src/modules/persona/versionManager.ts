// =============================================================================
// Version Manager - in-memory + localStorage hybrid
// =============================================================================
import type { Persona } from "./types";
import type { Memories } from "./memoriesTypes";

export interface VersionSnapshot {
  version: number;
  timestamp: string;
  personaId: string;
  persona: Persona;
  memories: Memories;
  changeDescription: string;
}

const STORAGE_PREFIX = "version_snapshots_";
const MAX_VERSIONS = 20;

// In-memory fallback cache (for test environments without localStorage)
const memoryCache = new Map<string, VersionSnapshot[]>();

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage !== null;
  } catch {
    return false;
  }
}

function loadSnapshots(personaId: string): VersionSnapshot[] {
  if (hasLocalStorage()) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + personaId);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
  }
  return memoryCache.get(personaId) || [];
}

function saveSnapshots(personaId: string, snapshots: VersionSnapshot[]): void {
  if (hasLocalStorage()) {
    try {
      localStorage.setItem(STORAGE_PREFIX + personaId, JSON.stringify(snapshots));
    } catch { /* storage full */ }
  }
  memoryCache.set(personaId, snapshots);
}

export function createSnapshot(
  persona: Persona,
  memories: Memories,
  changeDescription = "manual snapshot",
): VersionSnapshot {
  const snapshot: VersionSnapshot = {
    version: memories.meta.version,
    timestamp: new Date().toISOString(),
    personaId: persona.id,
    persona: JSON.parse(JSON.stringify(persona)),
    memories: JSON.parse(JSON.stringify(memories)),
    changeDescription,
  };
  const existing = loadSnapshots(persona.id);
  existing.push(snapshot);
  if (existing.length > MAX_VERSIONS) {
    existing.splice(0, existing.length - MAX_VERSIONS);
  }
  saveSnapshots(persona.id, existing);
  return snapshot;
}

export function getVersionHistory(personaId: string): VersionSnapshot[] {
  return loadSnapshots(personaId);
}

export function rollbackToVersion(
  personaId: string,
  targetVersion: number,
): { persona: Persona; memories: Memories } | null {
  const history = loadSnapshots(personaId);
  const snapshot = history.find((s) => s.version === targetVersion);
  if (!snapshot) return null;
  return {
    persona: JSON.parse(JSON.stringify(snapshot.persona)),
    memories: JSON.parse(JSON.stringify(snapshot.memories)),
  };
}

export function getLatestVersion(personaId: string): number {
  const history = loadSnapshots(personaId);
  return history.length > 0 ? history[history.length - 1].version : 0;
}
