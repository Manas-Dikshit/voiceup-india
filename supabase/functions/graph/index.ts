import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

async function getEmbedding(text: string) {
  const result = await model.embedContent(text);
  return result.embedding.values;
}

function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c; // in metres
  return d;
}

serve(async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    // Fetch core entities
    const { data: users, error: userError } = await supabase
      .from("profiles")
      .select("id, full_name");

    const { data: problems, error: problemError } = await supabase
      .from("problems")
      .select("id, title, description, created_at, latitude, longitude");

    const { data: ministries, error: ministryError } = await supabase
      .from("ministries")
      .select("id, name");

    const { data: relationships, error: relError } = await supabase
      .from("problem_relationships")
      .select("problem_id_a, problem_id_b, similarity_score, relationship_type");

    if (userError || problemError || ministryError || relError) {
      throw userError || problemError || ministryError || relError;
    }

    const embeddings = await Promise.all(
      problems.map((p) => getEmbedding(`${p.title} ${p.description}`))
    );

    const problemEmbeddings = problems.map((problem, i) => ({
      ...problem,
      embedding: embeddings[i],
    }));

    const clusters = [];
    const visited = new Array(problemEmbeddings.length).fill(false);
    const SIMILARITY_THRESHOLD = 0.8;
    const DISTANCE_THRESHOLD = 500; // 500 meters

    for (let i = 0; i < problemEmbeddings.length; i++) {
      if (visited[i]) continue;
      visited[i] = true;
      const cluster = [problemEmbeddings[i]];
      for (let j = i + 1; j < problemEmbeddings.length; j++) {
        if (visited[j]) continue;

        const distance = haversineDistance(
          problemEmbeddings[i].latitude,
          problemEmbeddings[i].longitude,
          problemEmbeddings[j].latitude,
          problemEmbeddings[j].longitude
        );

        if (distance < DISTANCE_THRESHOLD) {
          const similarity = cosineSimilarity(
            problemEmbeddings[i].embedding,
            problemEmbeddings[j].embedding
          );
          if (similarity > SIMILARITY_THRESHOLD) {
            visited[j] = true;
            cluster.push(problemEmbeddings[j]);
          }
        }
      }
      clusters.push(cluster);
    }

    const problemMap = new Map(problems.map(p => [p.id, p]));
    const nodes = [
      ...(users ?? []).map((u) => ({ id: u.id, type: "user", label: u.full_name })),
      ...(ministries ?? []).map((m) => ({ id: m.id, type: "ministry", label: m.name })),
    ];
    const edges = [];

    for (const cluster of clusters) {
      if (cluster.length > 1) {
        const masterProblem = cluster.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        nodes.push({ id: masterProblem.id, type: "problem", label: masterProblem.title });
        for (const problem of cluster) {
          if (problem.id !== masterProblem.id) {
            nodes.push({ id: problem.id, type: "problem", label: problem.title });
            edges.push({ source: masterProblem.id, target: problem.id, type: 'similar' });
          }
        }
      } else {
        nodes.push({ id: cluster[0].id, type: "problem", label: cluster[0].title });
      }
    }


    // Construct edges
    edges.push(
      ...(relationships ?? []).map((rel) => ({
        source: rel.problem_id_a,
        target: rel.problem_id_b,
        type: rel.relationship_type,
        strength: rel.similarity_score,
      }))
    );

    // Return response
    return new Response(JSON.stringify({ nodes, edges }), { headers });
  } catch (err) {
    console.error("graph-api error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});
