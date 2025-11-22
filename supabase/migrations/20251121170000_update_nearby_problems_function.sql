
drop function if exists nearby_problems;

create index problems_location_idx on problems using gist (location);

create or replace function nearby_problems(lat float, long float)
returns setof problems
language sql
as $$
  select *
  from problems
  where st_dwithin(
    location,
    st_point(long, lat)::geography,
    10000 -- 10 km radius
  )
  order by st_distance(location, st_point(long, lat)::geography)
$$;
