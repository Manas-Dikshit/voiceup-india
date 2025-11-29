import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";
import type {
  AISolutionSuggestion,
  GenerateSolutionsResult,
} from "../../../src/lib/ai-suggestions.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY") ?? "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const CACHE_TTL_MINUTES = 15;
const MAX_CHAR_LENGTH = 500;

const sanitizeText = (value: string): string => {
  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/\s*([,.!?;:])\s*/g, (match, p1) => `${p1} `)
    .trim();
  if (normalized.length <= MAX_CHAR_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_CHAR_LENGTH - 3).trim()}...`;
};

const coerceSuggestion = (raw: Record<string, unknown>, index: number): AISolutionSuggestion => {
  const fallbackTitle = raw?.title && typeof raw.title === "string"
    ? raw.title
    : `Actionable suggestion ${index + 1}`;

  const fallbackDesc = raw?.description && typeof raw.description === "string"
    ? raw.description
    : raw?.summary && typeof raw.summary === "string"
      ? raw.summary
      : "Detailed guidance unavailable. Review the problem context and craft a field-ready action.";

  const fallbackImpact = raw?.impact && typeof raw.impact === "string"
    ? raw.impact
    : "Clarify expected outcomes with the ministry ops team.";

  const fallbackNext = raw?.nextStep && typeof raw.nextStep === "string"
    ? raw.nextStep
    : raw?.next_steps && typeof raw.next_steps === "string"
      ? raw.next_steps
      : "Assign an owner, timeline, and monitoring cadence.";

  return {
    title: sanitizeText(fallbackTitle),
    description: sanitizeText(fallbackDesc),
    impact: sanitizeText(fallbackImpact),
    nextStep: sanitizeText(fallbackNext),
  };
};

const fallbackFromLines = (raw: string): AISolutionSuggestion[] => {
  const lines = raw
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.\)]\s*/, "").trim())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    return [
      {
        title: "Review problem details",
        description: sanitizeText("No structured AI response was returned. Please re-run the generator."),
        impact: "Ensures field teams still receive direction even when AI output is malformed.",
        nextStep: "Re-run the AI suggestion generator or draft solutions manually.",
      },
    ];
  }

  return lines.slice(0, 5).map((line, idx) => ({
    title: `Suggestion ${idx + 1}`,
    description: sanitizeText(line),
    impact: "Pending validation by the ministry operations cell.",
    nextStep: "Share with the relevant department lead for execution.",
  }));
};

const extractJsonArray = (raw: string): AISolutionSuggestion[] | null => {
  const cleaned = raw.replace(/```json|```/gi, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);

  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item, idx) => coerceSuggestion(item ?? {}, idx));
  } catch (error) {
    console.warn("Failed to parse Gemini JSON block", error);
    return null;
  }
};

const extractSuggestions = (raw: string): AISolutionSuggestion[] => {
  const jsonSuggestions = extractJsonArray(raw);
  const base = jsonSuggestions && jsonSuggestions.length ? jsonSuggestions : fallbackFromLines(raw);
  const sanitized = base.slice(0, 5);
  while (sanitized.length < 3) {
    sanitized.push({
      title: `Supplementary suggestion ${sanitized.length + 1}`,
      description: "Add a custom operational action for this problem.",
      impact: "Ensures field teams have at least three options to review.",
      nextStep: "Workshop the action with the civic operations cell.",
    });
  }
  return sanitized;
};

const fetchProblem = async (problemId: string) => {
  const { data, error } = await supabaseAdmin
    .from("problems")
    .select("id, title, description, category, city, status, votes_count")
    .eq("id", problemId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load problem ${problemId}: ${error.message}`);
  if (!data) throw new Error(`Problem ${problemId} was not found.`);

  return data;
};

type AiSolutionsRow = {
  id: string;
  suggestions: AISolutionSuggestion[];
  model: string;
  created_at: string;
  created_by: string | null;
};

export const fetchLatestAiSolutionsRow = async (
  problemId: string,
): Promise<AiSolutionsRow | null> => {
  const { data, error } = await supabaseAdmin
    .from("ai_solutions")
    .select("id, suggestions, model, created_by, created_at")
    .eq("problem_id", problemId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to read ai_solutions cache", error);
    throw new Error(error.message);
  }

  return data as AiSolutionsRow | null;
};

const getCachedSuggestions = async (problemId: string): Promise<GenerateSolutionsResult | null> => {
  let data: AiSolutionsRow | null = null;
  try {
    data = await fetchLatestAiSolutionsRow(problemId);
  } catch (error) {
    console.error("Unable to read cached AI data", error);
    return null;
  }

  if (!data) return null;

  const createdAt = new Date(data.created_at);
  const ageMinutes = (Date.now() - createdAt.getTime()) / (1000 * 60);
  if (ageMinutes > CACHE_TTL_MINUTES) {
    return null;
  }

  return {
    problemId,
    suggestions: data.suggestions as AISolutionSuggestion[],
    cached: true,
    cacheRowId: data.id,
    model: data.model,
    createdAt: data.created_at,
  };
};

const buildPrompt = (problem: Record<string, unknown>): string => `You are an expert civic operations co-pilot.
Generate 3 to 5 actionable, ministry-ready solutions for the following citizen problem.
Each suggestion MUST be a JSON object with fields: "title", "description", "impact", "nextStep".
Return ONLY a JSON array. No prose, no markdown.
Each field must be under 500 characters, practical, and locally grounded.

Problem ID: ${problem.id}
Title: ${problem.title}
Category: ${problem.category}
Status: ${problem.status ?? "Unknown"}
City/Region: ${problem.city ?? "Not provided"}
Votes: ${problem.votes_count ?? 0}
Details: ${problem.description}

Desired JSON template:
[
  {
    "title": "",
    "description": "",
    "impact": "",
    "nextStep": ""
  }
]
`;

const generateFreshSuggestions = async (
  problemId: string,
  requesterId?: string,
): Promise<GenerateSolutionsResult> => {
  const problem = await fetchProblem(problemId);
  const prompt = buildPrompt(problem);

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.35,
    },
  });

  const response = await result.response;
  const rawText = response.text() ?? "";
  const suggestions = extractSuggestions(rawText);

  const { data, error } = await supabaseAdmin
    .from("ai_solutions")
    .insert({
      problem_id: problemId,
      suggestions,
      model: "gemini-2.0-flash",
      created_by: requesterId ?? null,
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("Failed to cache AI solutions", error);
    throw new Error("Could not cache AI suggestions");
  }

  return {
    problemId,
    suggestions,
    cached: false,
    cacheRowId: data.id,
    model: "gemini-2.0-flash",
    createdAt: data.created_at,
  };
};

export const generateSolutionsForProblem = async (
  problemId: string,
  requesterId?: string,
): Promise<GenerateSolutionsResult> => {
  if (!problemId) {
    throw new Error("A valid problemId is required to generate suggestions.");
  }

  const cached = await getCachedSuggestions(problemId);
  if (cached) {
    return cached;
  }

  return generateFreshSuggestions(problemId, requesterId);
};

export const tryExtractProblemId = (input?: string | null): string | null => {
  if (!input) return null;
  const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/;
  const match = input.match(uuidRegex);
  return match ? match[0] : null;
};
