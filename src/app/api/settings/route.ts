import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, updateSettings, getAiApiKey, setAiApiKey } from "@/lib/settings";
import { AI_PROVIDERS } from "@/lib/ai";
import { apiError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [settings, key] = await Promise.all([getSettings(), getAiApiKey()]);
  return NextResponse.json({
    settings,
    aiConfigured: !!key,
    aiKeyPreview: key ? `••••${key.slice(-4)}` : null,
    providers: AI_PROVIDERS.map((p) => ({ id: p.id, label: p.label, defaultModel: p.defaultModel, keyHint: p.keyHint })),
  });
}

const schema = z.object({
  lowStockThreshold: z.number().int().min(0).optional(),
  dryIntervalDays: z.number().int().min(1).optional(),
  defaultBrand: z.string().min(1).optional(),
  defaultDiameterMm: z.number().positive().optional(),
  defaultWeightG: z.number().int().positive().optional(),
  defaultPrinterId: z.number().int().positive().nullable().optional(),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
  aiBaseUrl: z.string().optional(),
  developerMode: z.boolean().optional(),
  aiApiKey: z.string().optional(), // gestita a parte (write-only)
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
    const { aiApiKey, ...rest } = parsed.data;
    if (aiApiKey !== undefined) await setAiApiKey(aiApiKey.trim() || null);
    const settings = await updateSettings(rest);
    return NextResponse.json({ settings });
  } catch (e) {
    return apiError("settings", e, "Si è verificato un errore. Riprova.", 500);
  }
}
