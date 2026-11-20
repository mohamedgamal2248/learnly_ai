"use client";

/**
 * Files the AI makes are kept on the user's device (localStorage) as a small JSON spec.
 * Downloading rebuilds the real file on the server from that spec without storing anything.
 */
const INDEX = "ln-files-index";
const MAX = 40;

export function saveFileSpec(id: string, spec: unknown) {
  try {
    localStorage.setItem(`ln-file-${id}`, JSON.stringify(spec));
    const ids: string[] = JSON.parse(localStorage.getItem(INDEX) || "[]").filter((x: string) => x !== id);
    ids.push(id);
    while (ids.length > MAX) localStorage.removeItem(`ln-file-${ids.shift()}`);
    localStorage.setItem(INDEX, JSON.stringify(ids));
  } catch {
    // Storage full or blocked: the file can still be downloaded now from memory.
  }
}

export function hasFileSpec(id: string) {
  try { return localStorage.getItem(`ln-file-${id}`) !== null; } catch { return false; }
}

const memory = new Map<string, string>();
export function rememberSpec(id: string, spec: unknown) { memory.set(id, JSON.stringify(spec)); }

/**
 * Asks the server for a short-lived signed link, then navigates to it. A plain link is what Pi Browser
 * hands to Android's download manager, which can't send cookies or form data.
 */
export async function downloadFile(id: string): Promise<"ok" | "missing" | "error"> {
  let spec: string | null = memory.get(id) ?? null;
  if (!spec) { try { spec = localStorage.getItem(`ln-file-${id}`); } catch {} }
  if (!spec) return "missing";
  try {
    const r = await fetch("/api/files/prepare", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, spec: JSON.parse(spec) }),
    });
    if (!r.ok) return "error";
    const { url } = await r.json();
    window.location.href = url;
    return "ok";
  } catch {
    return "error";
  }
}

/** Downloads a task file (attachment or delivered result) through a short-lived signed link. */
export async function downloadTaskFile(id: string): Promise<"ok" | "error"> {
  try {
    const r = await fetch("/api/tasks/file", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    if (!r.ok) return "error";
    const { url } = await r.json();
    window.location.href = url;
    return "ok";
  } catch {
    return "error";
  }
}
