"use client";

import { useRef } from "react";
import { useApp } from "./AppProvider";
import { downloadTaskFile } from "@/lib/local-files";

export type TaskFile = { id: string; name: string; size: number; role?: string };
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx,.xlsx,.txt,.md,.csv";
const MAX = 3 * 1024 * 1024;

/** Download buttons for files attached to a task or to its result. */
export function TaskFiles({ files, label }: { files: TaskFile[]; label?: string }) {
  const { t, toast } = useApp();
  if (!files.length) return null;
  return (
    <div className="grid" style={{ gap: 6 }}>
      {label && <span className="hint">{label}</span>}
      <div className="row-actions">
        {files.map((f) => (
          <button key={f.id} className="btn sm" onClick={async () => { if ((await downloadTaskFile(f.id)) !== "ok") toast(t("dlError")); }}>
            <span className="ltr" style={{ overflowWrap: "anywhere" }}>{f.name}</span> <span className="hint num">{kb(f.size)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** A small picker for up to 3 files (3 MB each). Checks size and count before upload; the server checks the real type. */
export function FilePicker({ files, onChange, label, hint }: { files: File[]; onChange: (f: File[]) => void; label: string; hint?: string }) {
  const { t, toast } = useApp();
  const ref = useRef<HTMLInputElement>(null);
  function pick(list: FileList | null) {
    const next = [...files, ...Array.from(list || [])].slice(0, 3);
    if (next.some((f) => f.size > MAX)) { toast(t("tkFileBad")); return; }
    onChange(next);
    if (ref.current) ref.current.value = "";
  }
  return (
    <div className="grid" style={{ gap: 6 }}>
      <span className="hint">{label}</span>
      <input ref={ref} type="file" multiple accept={FILE_ACCEPT} onChange={(e) => pick(e.target.files)} disabled={files.length >= 3} />
      {files.length > 0 && (
        <div className="row-actions">
          {files.map((f, i) => (
            <button key={i} type="button" className="chip" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={t("remove")}>
              <span className="ltr">{f.name}</span> ✕
            </button>
          ))}
        </div>
      )}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
