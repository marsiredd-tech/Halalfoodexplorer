-- Enable extensions
create extension if not exists postgis;
create extension if not exists pgcrypto;

-- Tables
create table if not exists cert_bodies (
  id uuid primary key default gen_random_uuid(),
  body text unique not null,
  criteria text,
  audit text,
  reliability_score int check (reliability_score between 0 and 100)
);

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  cuisines text[] default '{}',
  website text,
  phone text,
  coords geography(Point,4326) not null
);
create index if not exists restaurants_coords_gix on restaurants using gist (coords);

create table if not exists certifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  cert_body_id uuid references cert_bodies(id) on delete set null,
  status text not null check (status in ('certified','self-declared','unknown','not-halal')),
  score int check (score between 0 and 100),
  last_verified date
);
create index if not exists certifications_restaurant_idx on certifications(restaurant_id);

-- Admins allowlist
create table if not exists admins (
  email text primary key
);

-- RLS
alter table cert_bodies enable row level security;
alter table restaurants enable row level security;
alter table certifications enable row level security;

-- Public read
create policy cert_bodies_read on cert_bodies for select using (true);
create policy restaurants_read on restaurants for select using (true);
create policy certifications_read on certifications for select using (true);

-- Write only if email is in admins
create policy cert_bodies_write on cert_bodies for all to authenticated
  using ( exists (select 1 from admins a where a.email = auth.jwt()->>'email') )
  with check ( exists (select 1 from admins a where a.email = auth.jwt()->>'email') );

create policy restaurants_write on restaurants for all to authenticated
  using ( exists (select 1 from admins a where a.email = auth.jwt()->>'email') )
  with check ( exists (select 1 from admins a where a.email = auth.jwt()->>'email') );

create policy certifications_write on certifications for all to authenticated
  using ( exists (select 1 from admins a where a.email = auth.jwt()->>'email') )
  with check ( exists (select 1 from admins a where a.email = auth.jwt()->>'email') );

-- RPC: nearby_restaurants
create or replace function nearby_restaurants(
  lat double precision,
  lng double precision,
  radius_km double precision,
  only_certified boolean default false
) returns table (
  id uuid,
  name text,
  address text,
  cuisines text[],
  website text,
  phone text,
  lat double precision,
  lng double precision,
  distance_km double precision,
  status text,
  cert_body text,
  score int,
  last_verified date
) language sql stable as $$
  with center as (
    select ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography g
  ),
  r as (
    select res.*,
           ST_Y(ST_AsText(res.coords::geometry)) as lat,
           ST_X(ST_AsText(res.coords::geometry)) as lng,
           ST_Distance(res.coords, (select g from center))/1000 as distance_km
    from restaurants res
    where ST_DWithin(res.coords, (select g from center), radius_km*1000)
  ),
  c as (
    select cert.restaurant_id, cert.status, cb.body as cert_body, cert.score, cert.last_verified
    from certifications cert
    left join cert_bodies cb on cb.id = cert.cert_body_id
  )
  select r.id, r.name, r.address, r.cuisines, r.website, r.phone, r.lat, r.lng, r.distance_km,
         c.status, c.cert_body, c.score, c.last_verified
  from r
  left join c on c.restaurant_id = r.id
  where (not only_certified) or c.status = 'certified'
  order by r.distance_km;
$$;

grant execute on function nearby_restaurants(double precision,double precision,double precision,boolean) to anon, authenticated;
