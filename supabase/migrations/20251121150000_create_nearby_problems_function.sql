create or replace function nearby_problems (
      lat float,
      long float
    )
    returns setof problems
    as $$
      select *
      from problems
      order by
        (
          6371 * acos(
            cos(radians(lat)) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(long)) +
            sin(radians(lat)) * sin(radians(latitude))
          )
        )
      limit 10;
    $$ language sql;