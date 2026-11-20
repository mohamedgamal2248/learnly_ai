import "server-only";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  get supabaseUrl() { return need("SUPABASE_URL").replace(/\/$/, ""); },
  get supabaseKey() { return need("SUPABASE_KEY"); },
  get dbSecret() { return need("LN_DB_SECRET"); },
  get sessionSecret() { return need("SESSION_SECRET"); },
  get piApiKey() { return need("PI_API_KEY"); },
  get metaApiKey() { return need("META_API_KEY"); },
  get metaModel() { return process.env.META_MODEL || "muse-ember-1.0"; },
  /** The app wallet's secret seed (starts with "S"). Only needed for creator withdrawals (app-to-user payments). */
  get piWalletSeed() { return process.env.PI_WALLET_SEED || ""; },
  /** "testnet" (default) or "mainnet". */
  get piNetwork() { return process.env.PI_NETWORK === "mainnet" ? "mainnet" : "testnet"; },
  get adminUsernames() {
    return (process.env.ADMIN_USERNAMES || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  },
};
