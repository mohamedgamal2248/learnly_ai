import type { Metadata } from "next";
import { rpc } from "@/lib/server/db";
import { BRAND } from "@/lib/brand";
import ProfileClient from "./ProfileClient";

type P = { searchParams: Promise<{ name?: string }> };

/** Every profile link gets its own preview (name, rating, task count) when shared in chats and social apps. */
export async function generateMetadata({ searchParams }: P): Promise<Metadata> {
  const name = ((await searchParams).name || "").trim().slice(0, 60);
  if (!name) return { title: "People" };
  const p = await rpc<{ username: string; headline: string; stats: { done: number; avg: number | null } } | null>("ln_profile_get", { p_viewer: null, p_username: name }).catch(() => null);
  if (!p) return { title: "People" };
  const desc = [p.headline, p.stats.avg ? `★ ${p.stats.avg}` : "", p.stats.done ? `${p.stats.done} tasks` : ""].filter(Boolean).join(" · ") || `${BRAND} profile`;
  const img = `/api/og/profile?name=${encodeURIComponent(p.username)}`;
  return {
    title: `@${p.username}`, description: desc,
    openGraph: { title: `@${p.username} · ${BRAND}`, description: desc, images: [{ url: img, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: `@${p.username} · ${BRAND}`, description: desc, images: [img] },
  };
}

export default function Page() { return <ProfileClient />; }
