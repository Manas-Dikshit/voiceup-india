import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY"));
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    const { problemId } = await req.json();

    if (!problemId) {
      return new Response(JSON.stringify({ error: "problemId required" }), {
        status: 400,
      });
    }

    // 1. Check cache first
    const { data: cached } = await supabase
      .from("ai_solutions")
      .select("*")
      .eq("problem_id", problemId)
      .limit(1);

    if (cached?.length > 0) {
      return new Response(
        JSON.stringify({ suggestions: cached[0].suggestions, cached: true }),
        { status: 200 }
      );
    }

    // 2. Get problem info
    const { data: problem } = await supabase
      .from("problems")
      .select("title, description, category")
      .eq("id", problemId)
      .single();

    if (!problem) throw new Error("Problem not found");

    const prompt = `
Generate 3 actionable solution suggestions for this civic issue.
Return JSON array like: [{"text":"solution 1"}, {"text":"solution 2"}].

Problem:
Title: ${problem.title}
Category: ${problem.category}
Description: ${problem.description}
`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    // extract array
    const json = raw.match(/\[[\s\S]*\]/);
    const suggestions = json ? JSON.parse(json[0]) : [];

    // 3. Save in DB
    await supabase.from("ai_solutions").insert([
      {
        problem_id: problemId,
        suggestions,
        model: "gemini-2.0-flash",
      },
    ]);

    return new Response(JSON.stringify({ suggestions, cached: false }), {
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
});

