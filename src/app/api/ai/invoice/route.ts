import { createClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { rateLimit, rateLimitResponseInit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

export const aiInvoiceInputSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(4000, "Description cannot exceed 4000 characters"),
  currency: z.string().trim().max(8).optional(),
});

export const aiInvoiceItemSchema = z.object({
  description: z.string().trim().min(1).max(500).default("Professional Services"),
  quantity: z.coerce.number().finite().nonnegative().max(1_000_000).default(1),
  unitPrice: z.coerce.number().finite().nonnegative().max(1_000_000_000).default(0),
});

export const aiInvoiceOutputSchema = z.object({
  items: z.array(aiInvoiceItemSchema).min(1).max(100),
  suggestedPaymentTerms: z.string().trim().max(100).default("Net 30"),
  notes: z.string().trim().max(2000).default(""),
});

export function sanitizeAiOutput(rawContent: string): z.infer<typeof aiInvoiceOutputSchema> {
  if (!rawContent || typeof rawContent !== "string") {
    throw new Error("AI output must be a non-empty string");
  }
  let cleaned = rawContent.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  }
  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI output must be an object");
  }
  return aiInvoiceOutputSchema.parse(parsed);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check tier
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      (profile.subscription_tier !== "pro" &&
        profile.subscription_tier !== "business")
    ) {
      return NextResponse.json(
        { error: "AI generator requires Pro plan" },
        { status: 403 }
      );
    }

    // The OpenAI call is the most expensive operation in the app — cap it.
    const limited = rateLimit(`ai:${user.id}`, 10, 60_000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        rateLimitResponseInit(limited)
      );
    }

    const parsed = aiInvoiceInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Description is required (max 4000 chars)" },
        { status: 400 }
      );
    }
    const { description, currency } = parsed.data;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional invoice assistant. Parse the following work description and return ONLY a valid JSON object (no preamble, no markdown, no backticks) with this structure:
{
  "items": [{ "description": string, "quantity": number, "unitPrice": number }],
  "suggestedPaymentTerms": string,
  "notes": string
}

Rules:
- Break work into specific line items with professional descriptions
- Use reasonable market rates if not specified in the description
- Quantity should reflect hours, units, or sessions as described
- Be specific about deliverables
- Default payment terms: "Net 30"
- Notes should be professional payment instructions
- Currency context: ${currency || "USD"}`,
        },
        {
          role: "user",
          content: description,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "AI generated empty response" },
        { status: 500 }
      );
    }

    try {
      const validatedResult = sanitizeAiOutput(content);
      return NextResponse.json(validatedResult);
    } catch (parseError) {
      console.error("AI response JSON parsing/validation failed:", parseError, "Raw content:", content);
      return NextResponse.json(
        { error: "Failed to parse AI invoice structure. Please try again with more details." },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("AI invoice error:", error);
    return NextResponse.json(
      { error: "Failed to generate invoice" },
      { status: 500 }
    );
  }
}
