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

/** Submits a normal form POST so Pi Browser treats the response as a download. */
export function downloadFile(id: string): boolean {
  let spec: string | null = memory.get(id) ?? null;
  if (!spec) { try { spec = localStorage.getItem(`ln-file-${id}`); } catch {} }
  if (!spec) return false;
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/files/render";
  form.style.display = "none";
  const input = document.createElement("input");
  input.type = "hidden"; input.name = "spec"; input.value = spec;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
  setTimeout(() => form.remove(), 1000);
  return true;
}
