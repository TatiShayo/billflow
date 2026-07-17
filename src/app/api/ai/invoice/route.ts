import { createClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { rateLimit, rateLimitResponseInit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

const aiInvoiceSchema = z.object({
  description: z.string().trim().min(1).max(4000),
  currency: z.string().trim().max(8).optional(),
});

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

    const parsed = aiInvoiceSchema.safeParse(await request.json().catch(() => null));
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
          content: `You are a professional invoice assistant. Parse the following work description and return ONLY a JSON object (no preamble, no markdown) with this structure:
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

    // Clean JSON parsing
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    }

    const result = JSON.parse(cleaned);

    return NextResponse.json(result);
  } catch (error) {
    console.error("AI invoice error:", error);
    return NextResponse.json(
      { error: "Failed to generate invoice" },
      { status: 500 }
    );
  }
}
