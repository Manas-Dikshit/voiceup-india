import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";
import { generateSolutionsForProblem, tryExtractProblemId } from "../_shared/ai-solutions.ts";
import type { ChatbotMetadata } from "../../../src/lib/ai-suggestions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY"));
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const getPublicStats = async () => {
  const { data, error } = await supabaseAdmin.rpc("get_ministry_dashboard_stats");
  if (error) throw new Error(`Failed to fetch stats: ${error.message}`);
  
  const { total_problems, problems_by_status, top_category } = data;
  
  let statsSummary = `Here are some current public statistics:\n`;
  statsSummary += `- Total problems reported: ${total_problems}\n`;
  statsSummary += `- Top problem category: ${top_category}\n`;
  statsSummary += `Problems by status:\n`;
  
  problems_by_status.forEach((s: { status: string, count: number }) => {
    statsSummary += `  - ${s.status}: ${s.count}\n`;
  });

  return statsSummary;
}

serve(async (req) => {
  console.log("Chatbot function invoked.");

  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request.");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, problemId: providedProblemId, requesterId } = await req.json();
    console.log("Received message:", message);

    if (!message) {
      console.error("No message provided in the request body.");
      return new Response(JSON.stringify({ error: "No message provided." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const extractedProblemId = providedProblemId ?? tryExtractProblemId(message);
    const intentPrompt = `
      You are an AI assistant for VoiceUp, a civic engagement platform.
      You SUPPORT THREE INTENTS ONLY:
      1. data_query - user asks for statistics or platform metrics. Respond exactly "INTENT:DATA_QUERY".
      2. suggest_solution - user wants AI-generated solutions for a specific problem id. Respond exactly "INTENT:SUGGEST_SOLUTION" or "INTENT:SUGGEST_SOLUTION|<problem_id>" if you can identify the UUID.
      3. general_chat - all other small-talk or onboarding questions. Respond conversationally.

      If the requester references Problem ID, issue ID, or includes a UUID, include it after the pipe symbol.
      If they explicitly mention "suggest", "solution", "fix", "recommendation", assume suggest_solution intent.

      User message: "${message}"
      Extracted problem id from client (if any): ${extractedProblemId ?? "none"}
    `;

    console.log("Determining intent with Gemini...");
    const intentResult = await model.generateContent(intentPrompt);
    const intentResponse = await intentResult.response;
    const intent = intentResponse.text();
    console.log("Intent determined:", intent);

    let botResponse;
    let metadata: ChatbotMetadata = { type: "general" };

    if (intent && intent.includes("INTENT:DATA_QUERY")) {
      console.log("Intent is DATA_QUERY. Fetching public stats...");
      botResponse = await getPublicStats();
      console.log("Stats fetched successfully.");
      metadata = { type: "data_query", data: { summary: botResponse } };
    } else if (intent && intent.includes("INTENT:SUGGEST_SOLUTION")) {
      console.log("Intent is SUGGEST_SOLUTION");

      const intentProblemId = tryExtractProblemId(intent);
      const problemId = intentProblemId ?? extractedProblemId;

      if (!problemId) {
        console.warn("Suggestion intent detected but no problemId could be resolved.");
        botResponse = "I need a valid problem ID to draft actionable solutions. Please provide the issue ID.";
      } else {
        const solutions = await generateSolutionsForProblem(problemId, requesterId);
        const summaryLines = solutions.suggestions
          .map((suggestion, idx) => `${idx + 1}. ${suggestion.title} — ${suggestion.description}`)
          .join("\n");
        botResponse = `Here are ${solutions.suggestions.length} AI-generated solution ideas for problem ${problemId}:\n${summaryLines}`;
        metadata = {
          type: "suggestion",
          data: {
            problemId,
            suggestions: solutions.suggestions,
            cached: solutions.cached,
            model: solutions.model,
            createdAt: solutions.createdAt,
          },
        };
      }
    } else {
      console.log("Intent is general_chat. Forwarding to Gemini for chat...");
      // For general chat, we create a chat session
      const chat = model.startChat({
        history: [
          {
            role: "user",
            parts: "You are a helpful and friendly AI assistant for the VoiceUp platform.",
          },
          {
            role: "model",
            parts: "Great, I'm ready to help!",
          },
        ],
      });
      
      const result = await chat.sendMessage(message);
      const response = await result.response;
      botResponse = response.text();
      console.log("General chat response received from Gemini.");
    }

    console.log("Final bot response:", botResponse);

    return new Response(JSON.stringify({ reply: botResponse, metadata }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("An error occurred in the main try-catch block:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
