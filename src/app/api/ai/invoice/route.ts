import { createClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";
import { NextResponse } from "next/server";

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

    const { description, currency } = await request.json();

    if (!description?.trim()) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

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
