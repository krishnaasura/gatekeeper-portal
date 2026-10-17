import { connections } from "@/lib/connections";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Share checks between visitors; targets come only from operator environment settings.
let cached: ReturnType<typeof connections> | undefined;
let expires = 0;
export async function GET() {
  if (!cached || Date.now() >= expires) {
    cached = connections();
    expires = Date.now() + 15000;
  }
  return Response.json({ connections: await cached }, { headers: { "Cache-Control": "no-store" } });
}
