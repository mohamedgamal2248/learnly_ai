import "server-only";

/** A file attached to a task (by the requester) or to a result (by the worker or its AI). Stored as base64 in the database. */
export type StoredFile = { name: string; mime: string; size: number; data: string };

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_MCP_FILE_BYTES = 1.5 * 1024 * 1024;

const ZIP = [0x50, 0x4b];
const TYPES: Record<string, { mime: string; magic?: number[]; text?: boolean; image?: boolean }> = {
  pdf: { mime: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46] },
  png: { mime: "image/png", magic: [0x89, 0x50, 0x4e, 0x47], image: true },
  jpg: { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff], image: true },
  jpeg: { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff], image: true },
  webp: { mime: "image/webp", magic: [0x52, 0x49, 0x46, 0x46], image: true },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: ZIP },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", magic: ZIP },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", magic: ZIP },
  txt: { mime: "text/plain; charset=utf-8", text: true },
  md: { mime: "text/markdown; charset=utf-8", text: true },
  csv: { mime: "text/csv; charset=utf-8", text: true },
};
export const ALLOWED_EXT = Object.keys(TYPES);

export const extOf = (name: string) => (name.toLowerCase().split(".").pop() || "").trim();
export const isImageName = (name: string) => !!TYPES[extOf(name)]?.image;

function cleanName(name: string) {
  const base = name.split(/[\\/]/).pop() || "file";
  return base.replace(/[\u0000-\u001F\u007F"<>|:*?]/g, "").trim().slice(0, 100) || "file";
}

/** Checks the type by extension AND by the file's first bytes, so a renamed program can't pass as a PDF. */
export function prepareFile(rawName: string, bytes: Uint8Array, maxBytes = MAX_FILE_BYTES): { ok: true; file: StoredFile } | { ok: false; error: string } {
  const name = cleanName(rawName);
  const ext = extOf(name);
  const type = TYPES[ext];
  if (!type) return { ok: false, error: "file_type" };
  if (!bytes.length) return { ok: false, error: "empty_file" };
  if (bytes.length > maxBytes) return { ok: false, error: "file_too_big" };
  if (type.magic && !type.magic.every((b, i) => bytes[i] === b)) return { ok: false, error: "file_type" };
  if (ext === "webp" && String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP") return { ok: false, error: "file_type" };
  if (type.text && bytes.slice(0, 4096).includes(0)) return { ok: false, error: "file_type" };
  return { ok: true, file: { name, mime: type.mime, size: bytes.length, data: Buffer.from(bytes).toString("base64") } };
}

/** Reads the files out of a multipart form field and validates them. */
export async function filesFromForm(form: FormData, field = "files"): Promise<{ ok: true; files: StoredFile[] } | { ok: false; error: string }> {
  const list = form.getAll(field).filter((x): x is File => x instanceof File && x.size > 0);
  if (list.length > MAX_FILES) return { ok: false, error: "too_many_files" };
  const out: StoredFile[] = [];
  let total = 0;
  for (const f of list) {
    const r = prepareFile(f.name, new Uint8Array(await f.arrayBuffer()));
    if (!r.ok) return r;
    total += r.file.size;
    out.push(r.file);
  }
  if (total > 4 * 1024 * 1024) return { ok: false, error: "file_too_big" };
  return { ok: true, files: out };
}

/** Files an AI sends through MCP: [{name, data_base64}] or [{name, content_text}]. */
export function filesFromAI(raw: unknown): { ok: true; files: StoredFile[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, files: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "bad_attachments" };
  if (raw.length > MAX_FILES) return { ok: false, error: "too_many_files" };
  const out: StoredFile[] = [];
  let total = 0;
  for (const a of raw) {
    if (!a || typeof a !== "object" || typeof (a as any).name !== "string") return { ok: false, error: "bad_attachments" };
    const x = a as { name: string; data_base64?: unknown; content_text?: unknown };
    let bytes: Uint8Array;
    if (typeof x.data_base64 === "string") {
      const b64 = x.data_base64.replace(/^data:[^,]*,/, "").replace(/\s/g, "");
      if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(b64)) return { ok: false, error: "bad_attachments" };
      bytes = Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    } else if (typeof x.content_text === "string") {
      bytes = new TextEncoder().encode(x.content_text);
    } else return { ok: false, error: "bad_attachments" };
    const r = prepareFile(x.name, bytes, MAX_MCP_FILE_BYTES);
    if (!r.ok) return r;
    total += r.file.size;
    out.push(r.file);
  }
  if (total > 3 * 1024 * 1024) return { ok: false, error: "file_too_big" };
  return { ok: true, files: out };
}
