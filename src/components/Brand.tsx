import { BRAND } from "@/lib/brand";

/** The wordmark: "Learnly" in ink and "AI" in the site's blue. Always left-to-right. */
export function Brand() {
  const [a, b] = BRAND.split(" ");
  return <span className="brand-word" dir="ltr">{a}{" "}<span className="brand-ai">{b}</span></span>;
}
