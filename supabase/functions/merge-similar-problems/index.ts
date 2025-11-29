import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)
const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })

async function getEmbedding(text: string) {
  const result = await model.embedContent(text)
  return result.embedding.values
}

function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Haversine distance in meters between two lat/lng points
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180
  const R = 6371000 // meters
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// DBSCAN-like clustering where neighbor condition is BOTH spatial proximity
// (distance <= spatialEpsMeters) AND semantic similarity (cosine >= simThreshold).
function clusterWithSpatialSemantic(points: any[], embeddings: number[][], options: { spatialEpsMeters: number; simThreshold: number; minSamples: number; }) {
  const { spatialEpsMeters, simThreshold, minSamples } = options
  const n = points.length
  const visited = new Array(n).fill(false)
  const clusterId = new Array(n).fill(-1)
  let cid = 0

  function neighbors(i: number) {
    const neigh: number[] = []
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const pA = points[i]
      const pB = points[j]
      if (pA.latitude == null || pA.longitude == null || pB.latitude == null || pB.longitude == null) continue
      const dist = haversineMeters(pA.latitude, pA.longitude, pB.latitude, pB.longitude)
      const sim = cosineSimilarity(embeddings[i], embeddings[j])
      if (dist <= spatialEpsMeters && sim >= simThreshold) {
        neigh.push(j)
      }
    }
    return neigh
  }

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue
    visited[i] = true
    const seed = neighbors(i)
    if (seed.length + 1 < minSamples) {
      clusterId[i] = -1 // noise
      continue
    }
    // start new cluster
    const stack = [...seed]
    clusterId[i] = cid
    while (stack.length > 0) {
      const j = stack.shift()!
      if (!visited[j]) {
        visited[j] = true
        const neighJ = neighbors(j)
        if (neighJ.length + 1 >= minSamples) {
          // expand
          for (const m of neighJ) {
            if (!stack.includes(m)) stack.push(m)
          }
        }
      }
      if (clusterId[j] === -1) {
        clusterId[j] = cid
      } else if (clusterId[j] === -1 || clusterId[j] === undefined) {
        clusterId[j] = cid
      } else {
        // already assigned to some cluster, keep existing
      }
    }
    cid++
  }

  const clusters: any[][] = []
  for (let k = 0; k < cid; k++) clusters.push([])
  for (let i = 0; i < n; i++) {
    const id = clusterId[i]
    if (id >= 0) clusters[id].push(points[i])
  }
  return clusters
}

serve(async (req) => {
  try {
    const { data: problems, error } = await supabase.from('problems').select('*')
    if (error) throw error

    const embeddings = await Promise.all(
      problems.map((p) => getEmbedding(p.description || ''))
    )

    // read clustering configuration from env (defaults)
    const SPATIAL_EPS_METERS = Number(Deno.env.get('MERGE_SPATIAL_EPS_METERS') || '500')
    const SIMILARITY_THRESHOLD = Number(Deno.env.get('MERGE_SIMILARITY_THRESHOLD') || '0.8')
    const MIN_SAMPLES = Number(Deno.env.get('MERGE_MIN_SAMPLES') || '2')

    const clusters = clusterWithSpatialSemantic(problems, embeddings, {
      spatialEpsMeters: SPATIAL_EPS_METERS,
      simThreshold: SIMILARITY_THRESHOLD,
      minSamples: MIN_SAMPLES,
    })

    // For each cluster, pick a master and produce suggested SQL for merging.
    const APPLY_MERGES = (Deno.env.get('APPLY_MERGES') || 'false').toLowerCase() === 'true'

    const results: any[] = []
    for (const cluster of clusters) {
      if (!cluster || cluster.length <= 1) {
        results.push({ cluster, master: cluster && cluster[0] ? cluster[0] : null, applied: false, applied_rows: [], suggested_sql: [] })
        continue
      }

      const sorted = [...cluster].sort((a, b) => {
        const va = (a.votes_count ?? 0)
        const vb = (b.votes_count ?? 0)
        if (va !== vb) return vb - va
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      const master = sorted[0]
      const mergedIds = cluster.map((p) => p.id).filter((id) => id !== master.id)

      const suggested_sql = mergedIds.map((id) =>
        `UPDATE public.problems SET merged_into = '${master.id}' WHERE id = '${id}';`
      )

      const applied_rows: any[] = []
      if (APPLY_MERGES && mergedIds.length > 0) {
        // perform updates and insert audit rows
        for (const mid of mergedIds) {
          const { error: upErr } = await supabase
            .from('problems')
            .update({ merged_into: master.id })
            .eq('id', mid)

          if (upErr) {
            applied_rows.push({ id: mid, success: false, error: upErr.message })
            continue
          }

          const { error: insErr } = await supabase.from('problem_merges').insert({
            master_problem_id: master.id,
            merged_problem_id: mid,
            merged_by: Deno.env.get('MERGE_RUN_BY') || 'merge-function',
            reason: `auto-merged by spatial+semantic cluster (eps=${SPATIAL_EPS_METERS}m,sim=${SIMILARITY_THRESHOLD})`,
          })

          if (insErr) {
            applied_rows.push({ id: mid, success: false, error: insErr.message })
          } else {
            applied_rows.push({ id: mid, success: true })
          }
        }
      }

      results.push({ cluster, master, applied: APPLY_MERGES, applied_rows, suggested_sql })
    }

    return new Response(JSON.stringify({ clusters: results, params: { SPATIAL_EPS_METERS, SIMILARITY_THRESHOLD, MIN_SAMPLES, APPLY_MERGES } }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
