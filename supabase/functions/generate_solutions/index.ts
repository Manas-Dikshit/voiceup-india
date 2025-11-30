import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// Configuration & Constants
// ============================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const GROQ_MODEL = "llama-3.1-70b-versatile";
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 30000;

// ============================================================
// Environment & Client Setup
// ============================================================

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!GROQ_API_KEY) {
  console.error("[generate_solutions] GROQ_API_KEY not set");
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[generate_solutions] Missing Supabase env vars", {
    hasUrl: !!SUPABASE_URL,
    hasKey: !!SUPABASE_SERVICE_ROLE_KEY,
  });
}

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

// Groq API client using fetch (no SDK dependency)
const callGroqAPI = async (prompt: string): Promise<string> => {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content || "";
};

// ============================================================
// Types
// ============================================================

interface AISolution {
  text: string;
}

interface AISolutionsRequest {
  problemId: string;
  ignoreCache?: boolean;
}

interface AISolutionsResponse {
  suggestions: AISolution[];
  cached: boolean;
}

interface Problem {
  id: string;
  title: string;
  description: string;
  category: string;
}

// ============================================================
// Utility Functions
// ============================================================

const logDebug = (msg: string, data?: unknown) => {
  console.log(`[generate_solutions] ${msg}`, data ? JSON.stringify(data) : "");
};

const logError = (msg: string, error?: unknown) => {
  console.error(`[generate_solutions] ${msg}`, error);
};

const respondError = (
  status: number,
  message: string,
  error?: unknown,
): Response => {
  logError(message, error);
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: CORS_HEADERS,
  });
};

const respondSuccess = (data: AISolutionsResponse): Response => {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: CORS_HEADERS,
  });
};

// ============================================================
// AI Generation with Fallback
// ============================================================

const generateSolutionsWithAI = async (problem: Problem): Promise<AISolution[]> => {
  if (!GROQ_API_KEY) {
    logError("Groq API key not configured");
    return getFallbackSolutions();
  }

  const prompt = `You are a civic solutions analyst. Generate exactly 3 actionable, realistic, and practical solutions for this civic problem.

STRICT REQUIREMENTS:
1. Return ONLY a JSON array of objects
2. Each object must have exactly one field: "text"
3. Each solution must be 1-2 sentences
4. No markdown, no explanations, no extra text
5. Valid JSON only

Example output format:
[
  {"text":"Install solar street lights in the area to reduce electricity costs"},
  {"text":"Form a community waste management committee for regular cleanup"},
  {"text":"Propose a water harvesting system to address supply issues"}
]

Problem Title: ${problem.title}
Category: ${problem.category}
Description: ${problem.description}

Now generate the solutions:`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logDebug(`AI generation attempt ${attempt}/${MAX_RETRIES}`);

      const responseText = await callGroqAPI(prompt);
      logDebug(`AI response (attempt ${attempt}):`, responseText.slice(0, 300));

      const solutions = parseAISolutions(responseText);
      if (solutions.length > 0) {
        logDebug(`Successfully generated ${solutions.length} solutions`);
        return solutions;
      }

      lastError = new Error("AI returned empty or invalid JSON");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logDebug(`Attempt ${attempt} failed:`, lastError?.message);
    }
  }

  logError(`Failed to generate solutions after ${MAX_RETRIES} attempts`, lastError);
  return getFallbackSolutions();
};

const parseAISolutions = (responseText: string): AISolution[] => {
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      logDebug("No JSON array found in response");
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      logDebug("Parsed value is not an array");
      return [];
    }

    const validated = parsed
      .filter(
        (item): item is AISolution =>
          item !== null &&
          typeof item === "object" &&
          typeof item.text === "string" &&
          item.text.trim().length > 0,
      )
      .map((item) => ({ text: item.text.trim() }))
      .slice(0, 3);

    if (validated.length === 0) {
      logDebug("No valid solutions found after filtering");
    }

    return validated;
  } catch (err) {
    logError("JSON parsing error", err);
    return [];
  }
};

const getFallbackSolutions = (): AISolution[] => {
  return [
    {
      text: "Form a community committee to assess and prioritize the issue with local officials",
    },
    {
      text: "Organize awareness campaigns and petition drives to gather public support",
    },
    {
      text: "Document the problem with photos and data, then submit formal grievance to relevant department",
    },
  ];
};

// ============================================================
// Database Operations
// ============================================================

const getProblem = async (problemId: string): Promise<Problem | null> => {
  if (!supabase) {
    logError("Supabase client not initialized");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("problems")
      .select("id, title, description, category")
      .eq("id", problemId)
      .single();

    if (error) {
      logError("Problem lookup error", error);
      return null;
    }

    return data as Problem;
  } catch (err) {
    logError("Problem fetch exception", err);
    return null;
  }
};

const getCachedSolutions = async (
  problemId: string,
): Promise<AISolution[] | null> => {
  if (!supabase) {
    logError("Supabase client not initialized");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("ai_solutions")
      .select("suggestions")
      .eq("problem_id", problemId)
      .limit(1)
      .single();

    if (error) {
      if (error.code !== "PGRST116") {
        logDebug("Cache lookup error (not critical)", error.message);
      }
      return null;
    }

    if (data && Array.isArray(data.suggestions)) {
      logDebug("Cache hit for problem", { problemId });
      return data.suggestions;
    }

    return null;
  } catch (err) {
    logDebug("Cache fetch exception (not critical)", err);
    return null;
  }
};

const purgeCachedSolutions = async (problemId: string): Promise<void> => {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from("ai_solutions")
      .delete()
      .eq("problem_id", problemId);

    if (error) {
      logDebug("Cache purge warning", error.message);
    } else {
      logDebug("Cache purged for problem", { problemId });
    }
  } catch (err) {
    logDebug("Cache purge exception (not critical)", err);
  }
};

const cacheSolutions = async (
  problemId: string,
  suggestions: AISolution[],
): Promise<void> => {
  if (!supabase) return;

  try {
    const { error } = await supabase.from("ai_solutions").insert([
      {
        problem_id: problemId,
        suggestions,
        model: GROQ_MODEL,
      },
    ]);

    if (error) {
      logDebug("Cache insert warning", error.message);
    } else {
      logDebug("Suggestions cached for problem", { problemId });
    }
  } catch (err) {
    logDebug("Cache insert exception (not critical)", err);
  }
};

// ============================================================
// Request Handler
// ============================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return respondError(405, "Method not allowed");
  }

  try {
    // Parse request body
    let payload: AISolutionsRequest;
    try {
      const body = await req.json();
      payload = body as AISolutionsRequest;
    } catch {
      return respondError(400, "Invalid JSON body");
    }

    const { problemId, ignoreCache = false } = payload;

    // Validate input
    if (!problemId || typeof problemId !== "string") {
      return respondError(400, "problemId (string) is required");
    }

    logDebug("Request received", { problemId, ignoreCache });

    // Check environment
    if (!GROQ_API_KEY || !supabase) {
      return respondError(500, "Server misconfigured: missing API keys");
    }

    // Check if problem exists
    const problem = await getProblem(problemId);
    if (!problem) {
      logDebug("Problem not found, returning fallback suggestions");
      return respondSuccess({ suggestions: getFallbackSolutions(), cached: false });
    }

    logDebug("Problem found", { problemId, title: problem.title });

    // Try to use cache if ignoreCache is false
    if (!ignoreCache) {
      const cached = await getCachedSolutions(problemId);
      if (cached && cached.length > 0) {
        logDebug("Returning cached solutions");
        return respondSuccess({ suggestions: cached, cached: true });
      }
    } else {
      // Purge old cache
      await purgeCachedSolutions(problemId);
    }

    // Generate new solutions
    logDebug("Generating fresh solutions using Groq");
    const suggestions = await generateSolutionsWithAI(problem);

    if (suggestions.length === 0) {
      logDebug("No solutions generated, returning fallback");
    }

    // Cache the results (best-effort)
    await cacheSolutions(problemId, suggestions);

    logDebug("Returning fresh solutions", {
      problemId,
      count: suggestions.length,
    });

    return respondSuccess({ suggestions, cached: false });
  } catch (err) {
    return respondError(500, "Unexpected server error", err);
  }
});
