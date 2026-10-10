import { NextResponse } from "next/server";
import { accountByRequest, readAiCredentials, writeAiCredentials } from "@/lib/server/secure-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers });

/** Return status only, never the stored secret (even partially). */
export async function GET(req: Request) {
  const account = accountByRequest(req);
  if (!account) return reply({ error: "unauthorized" }, 401);
  const saved = readAiCredentials(account.id);
  return reply({ configured: Boolean(saved), provider: saved?.provider ?? null });
}

export async function PUT(req: Request) {
  const account = accountByRequest(req);
  if (!account) return reply({ error: "unauthorized" }, 401);
  const origin = req.headers.get("origin");
  if (req.headers.get("sec-fetch-site") === "cross-site") return reply({ error: "forbidden" }, 403);
  if (origin) {
    // Next may normalize req.url to localhost; Host retains the browser-facing authority.
    try {
      const from = new URL(origin);
      if (!["http:", "https:"].includes(from.protocol) || from.host !== (req.headers.get("host") ?? new URL(req.url).host)) {
        return reply({ error: "forbidden" }, 403);
      }
    } catch { return reply({ error: "forbidden" }, 403); }
  }
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ error: "invalid_request" }, 400);
  // Bound input before parsing so this endpoint cannot receive arbitrary-size secrets.
  const text = await req.text();
  if (text.length > 6000) return reply({ error: "invalid_key" }, 400);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return reply({ error: "invalid_request" }, 400); }
  if (!body || typeof body !== "object") return reply({ error: "invalid_request" }, 400);
  const { provider, apiKey } = body as { provider?: unknown; apiKey?: unknown };
  if (provider !== "glm" && provider !== "claude") return reply({ error: "invalid_provider" }, 400);
  if (typeof apiKey !== "string" || !apiKey.trim() || apiKey.trim().length > 4096 || /[\s\x00-\x1f\x7f]/.test(apiKey.trim())) {
    return reply({ error: "invalid_key" }, 400);
  }
  writeAiCredentials(account.id, { provider, apiKey: apiKey.trim() });
  return reply({ configured: true, provider });
}
