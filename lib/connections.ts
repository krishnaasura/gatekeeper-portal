export const SERVICE_IDS = ["argo", "headlamp", "scout", "launchpad", "amip", "aris", "nutrisage"] as const;
export type ServiceId = typeof SERVICE_IDS[number];
const prefixes: Record<Exclude<ServiceId, "scout">, string> = {
  argo: "ARGOCD", headlamp: "HEADLAMP", launchpad: "LAUNCHPAD", amip: "AMIP", aris: "ARIS", nutrisage: "NUTRISAGE",
};

export type Connection = {
  id: ServiceId;
  href?: string;
  status: "checking" | "reachable" | "online" | "unavailable" | "unconfigured" | "invalid" | "tls-error";
  detail: string;
};

export function publicUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const url = new URL(value.trim());
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error("Use an HTTP(S) URL without credentials, query, or fragment.");
  return url.href;
}

export async function probe(id: Connection["id"], href: string | undefined, target: string | undefined,
  fetcher: typeof fetch = fetch): Promise<Connection> {
  if (!href) return { id, status: "unconfigured", detail: "Launch address is not configured yet." };
  try {
    const response = await fetcher(target || href, {
      cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(4000),
    });
    if (id === "scout") {
      const body = response.ok ? await response.json() : null;
      return { id, href, status: body?.healthy === true ? "online" : "unavailable",
        detail: body?.healthy === true ? "Your watchlist is ready." : "Price Scout did not pass its health check." };
    }
    // Login pages, login redirects and auth challenges prove reachability, not cluster health.
    const reachable = response.ok || [301, 302, 303, 307, 308, 401, 403].includes(response.status);
    await response.body?.cancel();
    return { id, href, status: reachable ? "reachable" : "unavailable",
      detail: reachable ? "App responds. Sign in at the destination; cluster health is not checked."
        : `App returned HTTP ${response.status}.` };
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code || "";
    const tls = /CERT|TLS|SSL|SELF_SIGNED/.test(code);
    return { id, href, status: tls ? "tls-error" : "unavailable",
      detail: tls ? "Certificate could not be verified. Configure a trusted certificate."
        : "Not reachable from Gatekeeper. Check the homelab, Tailscale, and the service address." };
  }
}

export async function connections(env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch) {
  return Promise.all(SERVICE_IDS.map(async id => {
    try {
      const prefix = id === "scout" ? undefined : prefixes[id];
      const href = id === "scout" ? "/price-scout" : publicUrl(env[`${prefix}_URL`]);
      const target = id === "scout"
        ? new URL("/price-scout/api/health", publicUrl(env.PRICE_SCOUT_ORIGIN) || "http://127.0.0.1:8091").href
        : publicUrl(env[`${prefix}_CHECK_URL`]);
      return await probe(id, href, target, fetcher);
    } catch {
      return { id, status: "invalid", detail: "Service URL configuration needs attention." } satisfies Connection;
    }
  }));
}
