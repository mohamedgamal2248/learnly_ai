"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Renders its children straight into <body>, so sheets and dialogs always sit above the page, header and bottom bar. */
export function Portal({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(false);
  useEffect(() => { setOk(true); }, []);
  return ok ? createPortal(children, document.body) : null;
}
