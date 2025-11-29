import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { problem_id, new_status, comment, actor_id } = body
    if (!problem_id || !new_status) {
      return new Response(JSON.stringify({ error: 'Missing problem_id or new_status' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Update problem status using service role client (bypass RLS)
    const { error: updateError } = await supabase
      .from('problems')
      .update({ status: new_status })
      .eq('id', problem_id)

    if (updateError) throw updateError

    // Insert audit log
    try {
      await supabase.from('audit_logs').insert({
        actor_id: actor_id || null,
        action_type: 'status_change',
        target_id: problem_id,
        details: `Status changed to ${new_status}. Comment: ${comment || ''}`,
      })
    } catch (e) {
      // non-blocking
      console.error('audit log error', e)
    }

    // Notify problem owner if present
    try {
      const { data: pd } = await supabase.from('problems').select('user_id, title').eq('id', problem_id).single()
      if (pd && pd.user_id) {
        await supabase.from('notifications').insert({
          user_id: pd.user_id,
          message: `The status of your reported problem "${pd.title || ''}" has been updated to ${new_status}.`,
          type: 'status_update',
        })
      }
    } catch (e) {
      console.error('notification error', e)
    }

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
