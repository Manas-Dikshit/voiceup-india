-- Fix security definer view warning by using security_invoker
-- Drop and recreate the impact_tracker view with SECURITY INVOKER (default behavior)
DROP VIEW IF EXISTS public.impact_tracker;

CREATE VIEW public.impact_tracker 
WITH (security_invoker = true)
AS
SELECT 
    p.category,
    p.city as location,
    COUNT(*) FILTER (WHERE p.status = 'completed') as resolved_count,
    COUNT(*) FILTER (WHERE p.status IN ('reported', 'under_review', 'approved', 'in_progress')) as pending_count,
    COALESCE(
        EXTRACT(EPOCH FROM AVG(
            CASE WHEN p.status = 'completed' 
            THEN p.updated_at - p.created_at 
            END
        )) / 3600,
        0
    )::INTEGER as avg_response_time,
    COALESCE(SUM(p.votes_count), 0)::INTEGER as engagement_score,
    gen_random_uuid() as id
FROM public.problems p
WHERE p.is_deleted IS NOT TRUE
GROUP BY p.category, p.city;