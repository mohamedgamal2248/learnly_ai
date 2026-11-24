import { TR } from "./ui-strings";

/** Languages of the site itself. Arabic is right-to-left, the others left-to-right. */
export type UiL = "en" | "ar" | "id" | "vi" | "ko";
export const SITE_LANGS: { code: UiL; label: string; dir: "rtl" | "ltr" }[] = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "id", label: "Bahasa Indonesia", dir: "ltr" },
  { code: "vi", label: "Tiếng Việt", dir: "ltr" },
  { code: "ko", label: "한국어", dir: "ltr" },
];
export const isSiteLang = (v: unknown): v is UiL => SITE_LANGS.some((l) => l.code === v);
export const dirOf = (l: UiL): "rtl" | "ltr" => (l === "ar" ? "rtl" : "ltr");
const IDX = { ar: 0, id: 1, vi: 2, ko: 3 } as const;
export const LOCALE: Record<UiL, string> = { en: "en-GB", ar: "ar-EG-u-nu-latn", id: "id-ID", vi: "vi-VN", ko: "ko-KR" };

/** English source text -> text in the site language. Missing translations fall back to English, so nothing ever breaks. */
export function tr(lang: UiL, s: string, vars?: Record<string, string | number>): string {
  let out = s;
  if (lang !== "en") { const row = TR[s]; if (row && row[IDX[lang]]) out = row[IDX[lang]]; }
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}
