-- Impact Tracker View for Civic Engagement Metrics
-- This view aggregates problem resolution and engagement data for dashboards
CREATE OR REPLACE VIEW impact_tracker AS
SELECT
    uuid_generate_v4() AS id,
    p.category,
    p.location,
    COUNT(CASE WHEN p.status = 'completed' THEN 1 END) AS resolved_count,
    COUNT(CASE WHEN p.status IN ('reported', 'under_review', 'approved', 'in_progress') THEN 1 END) AS pending_count,
    AVG(EXTRACT(EPOCH FROM (CASE WHEN p.status = 'completed' THEN p.updated_at ELSE NULL END - p.created_at))/3600) AS avg_response_time,
    (COUNT(v.id) + COUNT(c.id))::numeric / NULLIF(COUNT(DISTINCT p.id), 0) AS engagement_score,
    NOW() AS last_updated
FROM problems p
LEFT JOIN solutions s ON s.problem_id = p.id
LEFT JOIN votes v ON v.problem_id = p.id
LEFT JOIN comments c ON c.problem_id = p.id
GROUP BY p.category, p.location;