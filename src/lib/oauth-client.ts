/** The client id is a signed blob we issued (payload is readable); show its app name on the consent page. */
export function oauthAppName(clientId: string): string {
  try {
    const body = clientId.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(decodeURIComponent(escape(atob(body))));
    return typeof json?.n === "string" && json.n ? json.n.slice(0, 80) : "AI app";
  } catch { return "AI app"; }
}
