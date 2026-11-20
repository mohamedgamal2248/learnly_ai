import "server-only";

/**
 * True when a message tries to move the deal outside the site (phone number, e-mail, link, or a chat app name).
 * Paying outside the site skips the escrow, which is the thing that protects both sides.
 */
export function hasContactInfo(text: string): boolean {
  const t = text.normalize("NFKC").toLowerCase();
  const digits = t.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[\s.\-()+]/g, "");
  if (/\d{9,}/.test(digits)) return true;
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(t)) return true;
  if (/(https?:\/\/|www\.|t\.me\/|wa\.me\/|\.com\b|\.net\b|\.org\b|\.me\/)/.test(t)) return true;
  if (/(whats\s?app|واتس\s?اب|واتساب|وتس|telegram|تليجرام|تيليجرام|تلجرام|signal|viber|فايبر|instagram|انستجرام|انستا|discord|ديسكورد)/.test(t)) return true;
  return false;
}
