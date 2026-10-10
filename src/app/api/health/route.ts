import { withAiCredentials } from "@/lib/server/ai-context";
import { NextResponse } from "next/server";
import { glmAsrModel, glmConfigured, glmModel, glmPing, glmVisionModel } from "@/lib/ai/glm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGET(req: Request) {
  const ping = new URL(req.url).searchParams.get("ping") === "1";
  const configured = glmConfigured();
  const model = glmModel();
  const extra = { visionModel: glmVisionModel(), speechModel: glmAsrModel() };
  if (!configured || !ping) return NextResponse.json({ configured, model, ...extra });
  const result = await glmPing();
  return NextResponse.json({ configured, model, ...extra, ...result });
}

export const GET = withAiCredentials(handleGET);
