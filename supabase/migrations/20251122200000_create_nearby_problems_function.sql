CREATE OR REPLACE FUNCTION nearby_problems(lat float, long float)
RETURNS TABLE (
  id bigint,
  created_at timestamptz,
  title text,
  description text,
  category text,
  status text,
  upvotes_count integer,
  latitude float,
  longitude float,
  media_url text,
  user_id uuid,
  distance float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.created_at,
    p.title,
    p.description,
    p.category,
    p.status,
    p.upvotes_count,
    p.latitude,
    p.longitude,
    p.media_url,
    p.user_id,
    (
      6371 * acos(
        cos(radians(lat)) * cos(radians(p.latitude)) *
        cos(radians(p.longitude) - radians(long)) +
        sin(radians(lat)) * sin(radians(p.latitude))
      )
    ) AS distance
  FROM
    public.problems p
  ORDER BY
    distance
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;
