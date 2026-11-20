// Arabic-speaking countries (Arab League members). Everyone else starts in English.
const ARABIC = new Set(["EG", "SA", "AE", "KW", "QA", "BH", "OM", "YE", "IQ", "SY", "JO", "LB", "PS", "LY", "TN", "DZ", "MA", "MR", "SD", "SO", "DJ", "KM"]);

/** Suggests a starting language from the visitor's country (Vercel adds the header from the IP). */
export function GET(req: Request) {
  const country = (req.headers.get("x-vercel-ip-country") || "").toUpperCase();
  const lang = !country || ARABIC.has(country) ? "ar" : "en";
  return new Response(JSON.stringify({ country, lang }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}
