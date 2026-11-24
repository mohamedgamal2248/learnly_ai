// Arabic-speaking countries (Arab League members).
const ARABIC = new Set(["EG", "SA", "AE", "KW", "QA", "BH", "OM", "YE", "IQ", "SY", "JO", "LB", "PS", "LY", "TN", "DZ", "MA", "MR", "SD", "SO", "DJ", "KM"]);
const BY_COUNTRY: Record<string, string> = {
  VN: "vi", ID: "id", PH: "tl", IN: "hi", KR: "ko", CN: "zh", TW: "zh", HK: "zh", SG: "en",
  ES: "es", MX: "es", AR: "es", CO: "es", PE: "es", CL: "es", VE: "es", EC: "es", GT: "es", BO: "es", DO: "es", HN: "es", PY: "es", SV: "es", NI: "es", CR: "es", PA: "es", UY: "es", CU: "es",
  FR: "fr", BE: "fr", CI: "fr", SN: "fr", CM: "fr", CD: "fr", ML: "fr", BF: "fr", NE: "fr", GN: "fr", BJ: "fr", TG: "fr", HT: "fr", GA: "fr", CG: "fr",
};

/** Suggests a starting language from the visitor's country (Vercel adds the header from the IP). */
export function GET(req: Request) {
  const country = (req.headers.get("x-vercel-ip-country") || "").toUpperCase();
  const lang = !country ? "en" : ARABIC.has(country) ? "ar" : BY_COUNTRY[country] || "en";
  return new Response(JSON.stringify({ country, lang }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}
