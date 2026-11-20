import { BRAND } from "@/lib/brand";

/** The wordmark: only the H carries the blue underline. Always left-to-right, even on Arabic pages. */
export function Brand() {
  return <span className="brand-word" dir="ltr"><span className="brand-h">{BRAND.slice(0, 1)}</span>{BRAND.slice(1)}</span>;
}
