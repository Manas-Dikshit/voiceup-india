import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { OpenAI } from "https://esm.sh/openai@4.10.0";

// Define CORS headers directly in the function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

// Placeholder for a function that calls an AI service (e.g., OpenAI)
// In a real scenario, you would use the fetch API to call the AI provider's endpoint
async function getAIInsights(description: string): Promise<{ summary: string; tags: string[] }> {
  const prompt = `
    Analyze the following citizen problem report. Provide a concise, one-sentence summary and a JSON array of 3-5 relevant keyword tags.
    The output should be a single JSON object with two keys: "summary" and "tags".

    Problem Description:
    "${description}"

    JSON Output:
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 150,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("OpenAI returned no content.");
  }

  try {
    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary || "AI summary could not be generated.",
      tags: parsed.tags || [],
    };
  } catch (e) {
    console.error("Failed to parse OpenAI response:", e);
    throw new Error("Invalid JSON response from OpenAI.");
  }
}

serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { record } = await req.json();

    // 1. We only want to process new problems
    if (!record || !record.id || !record.description) {
      return new Response(JSON.stringify({ error: "Invalid record provided." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 2. Generate AI summary and tags
    const { summary, tags } = await getAIInsights(record.description);

    // 3. Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 4. Update the problem record with the AI-generated data
    const { error: updateError } = await supabaseAdmin
      .from("problems")
      .update({
        ai_summary: summary,
        ai_tags: tags,
      })
      .eq("id", record.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ message: `Successfully processed problem ${record.id}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
