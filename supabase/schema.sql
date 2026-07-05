-- ============================================================
-- HIPARIS Supabase Schema
-- ============================================================
-- This schema is designed for the current HIPARIS frontend.
-- It creates:
-- - organizations
-- - buildings
-- - floors
-- - accessible_elements
-- - route_edges
-- - storage bucket: plan-images
-- - Row Level Security policies
--
-- IMPORTANT:
-- If you already have production data, back it up before modifying
-- the schema. This file is safe for a fresh hackathon database.
-- ============================================================


-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------

create extension if not exists pgcrypto;


-- ------------------------------------------------------------
-- Utility trigger: updated_at
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ------------------------------------------------------------
-- Organizations
-- ------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  type text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organizations_name_not_empty check (char_length(trim(name)) > 0)
);

create index if not exists organizations_owner_id_idx
on public.organizations(owner_id);

drop trigger if exists organizations_set_updated_at on public.organizations;

create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();


-- ------------------------------------------------------------
-- Buildings
-- ------------------------------------------------------------

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references public.organizations(id) on delete cascade,

  name text not null,
  address text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint buildings_name_not_empty check (char_length(trim(name)) > 0)
);

create index if not exists buildings_organization_id_idx
on public.buildings(organization_id);

drop trigger if exists buildings_set_updated_at on public.buildings;

create trigger buildings_set_updated_at
before update on public.buildings
for each row
execute function public.set_updated_at();


-- ------------------------------------------------------------
-- Floors
-- ------------------------------------------------------------

create table if not exists public.floors (
  id uuid primary key default gen_random_uuid(),

  building_id uuid not null references public.buildings(id) on delete cascade,

  level integer not null,
  name text not null,

  plan_image_path text,
  plan_image_width integer,
  plan_image_height integer,
  plan_image_size_bytes bigint,
  plan_image_mime_type text,
  plan_original_name text,
  plan_uploaded_at timestamptz,

  real_width_meters numeric,
  real_height_meters numeric,
  meters_per_pixel_x numeric,
  meters_per_pixel_y numeric,

  plan_rotation_degrees numeric,
  plan_crop_json jsonb not null default '{}'::jsonb,

  status text not null default 'uploaded',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint floors_name_not_empty check (char_length(trim(name)) > 0),

  constraint floors_status_valid check (
    status in ('uploaded', 'processing', 'needs_review', 'published')
  ),

  constraint floors_plan_dimensions_positive check (
    (plan_image_width is null or plan_image_width > 0)
    and
    (plan_image_height is null or plan_image_height > 0)
  ),

  constraint floors_real_dimensions_positive check (
    (real_width_meters is null or real_width_meters > 0)
    and
    (real_height_meters is null or real_height_meters > 0)
  )
);

create index if not exists floors_building_id_idx
on public.floors(building_id);

create index if not exists floors_status_idx
on public.floors(status);

drop trigger if exists floors_set_updated_at on public.floors;

create trigger floors_set_updated_at
before update on public.floors
for each row
execute function public.set_updated_at();


-- ------------------------------------------------------------
-- Accessible Elements
-- ------------------------------------------------------------

create table if not exists public.accessible_elements (
  id uuid primary key default gen_random_uuid(),

  floor_id uuid not null references public.floors(id) on delete cascade,

  type text not null,
  label text,

  -- Normalized coordinates inside the displayed floor plan.
  -- x = 0 means left side, x = 1 means right side.
  -- y = 0 means top side, y = 1 means bottom side.
  x numeric not null,
  y numeric not null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint accessible_elements_type_valid check (
    type in (
      'entrance',
      'elevator',
      'ramp',
      'stairs',
      'door',
      'room',
      'obstacle',
      'toilet'
    )
  ),

  constraint accessible_elements_coordinates_normalized check (
    x >= 0 and x <= 1 and y >= 0 and y <= 1
  )
);

create index if not exists accessible_elements_floor_id_idx
on public.accessible_elements(floor_id);

create index if not exists accessible_elements_type_idx
on public.accessible_elements(type);

drop trigger if exists accessible_elements_set_updated_at on public.accessible_elements;

create trigger accessible_elements_set_updated_at
before update on public.accessible_elements
for each row
execute function public.set_updated_at();


-- ------------------------------------------------------------
-- Route Edges
-- ------------------------------------------------------------

create table if not exists public.route_edges (
  id uuid primary key default gen_random_uuid(),

  floor_id uuid not null references public.floors(id) on delete cascade,

  from_element_id uuid not null references public.accessible_elements(id) on delete cascade,
  to_element_id uuid not null references public.accessible_elements(id) on delete cascade,

  distance_meters numeric not null,

  wheelchair_accessible boolean not null default true,
  crutches_accessible boolean not null default true,
  is_bidirectional boolean not null default true,

  notes text,

  edge_type text not null default 'corridor',

  slope_percent numeric,
  width_cm numeric,
  step_height_cm numeric,

  surface_type text default 'normal',
  door_type text,

  assistance_required boolean not null default false,
  accessibility_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint route_edges_no_self_loop check (
    from_element_id <> to_element_id
  ),

  constraint route_edges_distance_positive check (
    distance_meters > 0
  ),

  constraint route_edges_type_valid check (
    edge_type in (
      'corridor',
      'door',
      'ramp',
      'elevator',
      'stairs',
      'threshold',
      'manual'
    )
  ),

  constraint route_edges_surface_type_valid check (
    surface_type is null
    or surface_type in (
      'normal',
      'slippery',
      'carpet',
      'irregular',
      'gravel',
      'unknown'
    )
  ),

  constraint route_edges_door_type_valid check (
    door_type is null
    or door_type in (
      'automatic',
      'manual_light',
      'manual_heavy',
      'push',
      'pull',
      'unknown'
    )
  ),

  constraint route_edges_physical_values_valid check (
    (slope_percent is null or slope_percent >= 0)
    and
    (width_cm is null or width_cm > 0)
    and
    (step_height_cm is null or step_height_cm >= 0)
  )
);

create index if not exists route_edges_floor_id_idx
on public.route_edges(floor_id);

create index if not exists route_edges_from_element_id_idx
on public.route_edges(from_element_id);

create index if not exists route_edges_to_element_id_idx
on public.route_edges(to_element_id);

drop trigger if exists route_edges_set_updated_at on public.route_edges;

create trigger route_edges_set_updated_at
before update on public.route_edges
for each row
execute function public.set_updated_at();


-- ------------------------------------------------------------
-- Ownership helper functions
-- ------------------------------------------------------------

create or replace function public.is_building_owner(_building_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.buildings b
    join public.organizations o on o.id = b.organization_id
    where b.id = _building_id
      and o.owner_id = auth.uid()
  );
$$;

create or replace function public.is_floor_owner(_floor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.floors f
    join public.buildings b on b.id = f.building_id
    join public.organizations o on o.id = b.organization_id
    where f.id = _floor_id
      and o.owner_id = auth.uid()
  );
$$;

create or replace function public.is_floor_published(_floor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.floors f
    where f.id = _floor_id
      and f.status = 'published'
  );
$$;


-- ------------------------------------------------------------
-- Route edge consistency trigger
-- ------------------------------------------------------------
-- Ensures that both connected elements belong to the same floor
-- as the route edge.

create or replace function public.validate_route_edge_same_floor()
returns trigger
language plpgsql
as $$
declare
  from_floor uuid;
  to_floor uuid;
begin
  select floor_id into from_floor
  from public.accessible_elements
  where id = new.from_element_id;

  select floor_id into to_floor
  from public.accessible_elements
  where id = new.to_element_id;

  if from_floor is null or to_floor is null then
    raise exception 'Both route edge elements must exist.';
  end if;

  if from_floor <> new.floor_id or to_floor <> new.floor_id then
    raise exception 'Route edge elements must belong to the same floor as the edge.';
  end if;

  return new;
end;
$$;

drop trigger if exists route_edges_validate_same_floor on public.route_edges;

create trigger route_edges_validate_same_floor
before insert or update on public.route_edges
for each row
execute function public.validate_route_edge_same_floor();


-- ------------------------------------------------------------
-- Enable Row Level Security
-- ------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.buildings enable row level security;
alter table public.floors enable row level security;
alter table public.accessible_elements enable row level security;
alter table public.route_edges enable row level security;


-- ------------------------------------------------------------
-- Clean previous policies
-- ------------------------------------------------------------

drop policy if exists "organization owners can manage organizations" on public.organizations;
drop policy if exists "public can read organizations with published floors" on public.organizations;

drop policy if exists "organization owners can manage buildings" on public.buildings;
drop policy if exists "public can read buildings with published floors" on public.buildings;

drop policy if exists "organization owners can manage floors" on public.floors;
drop policy if exists "public can read published floors" on public.floors;

drop policy if exists "organization owners can manage accessible elements" on public.accessible_elements;
drop policy if exists "public can read elements from published floors" on public.accessible_elements;

drop policy if exists "organization owners can manage route edges" on public.route_edges;
drop policy if exists "public can read edges from published floors" on public.route_edges;


-- ------------------------------------------------------------
-- Organizations policies
-- ------------------------------------------------------------

create policy "organization owners can manage organizations"
on public.organizations
for all
to authenticated
using (
  owner_id = auth.uid()
)
with check (
  owner_id = auth.uid()
);

create policy "public can read organizations with published floors"
on public.organizations
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.buildings b
    join public.floors f on f.building_id = b.id
    where b.organization_id = organizations.id
      and f.status = 'published'
  )
);


-- ------------------------------------------------------------
-- Buildings policies
-- ------------------------------------------------------------

create policy "organization owners can manage buildings"
on public.buildings
for all
to authenticated
using (
  exists (
    select 1
    from public.organizations o
    where o.id = buildings.organization_id
      and o.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organizations o
    where o.id = buildings.organization_id
      and o.owner_id = auth.uid()
  )
);

create policy "public can read buildings with published floors"
on public.buildings
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.floors f
    where f.building_id = buildings.id
      and f.status = 'published'
  )
);


-- ------------------------------------------------------------
-- Floors policies
-- ------------------------------------------------------------

create policy "organization owners can manage floors"
on public.floors
for all
to authenticated
using (
  public.is_building_owner(building_id)
)
with check (
  public.is_building_owner(building_id)
);

create policy "public can read published floors"
on public.floors
for select
to anon, authenticated
using (
  status = 'published'
);


-- ------------------------------------------------------------
-- Accessible Elements policies
-- ------------------------------------------------------------

create policy "organization owners can manage accessible elements"
on public.accessible_elements
for all
to authenticated
using (
  public.is_floor_owner(floor_id)
)
with check (
  public.is_floor_owner(floor_id)
);

create policy "public can read elements from published floors"
on public.accessible_elements
for select
to anon, authenticated
using (
  public.is_floor_published(floor_id)
);


-- ------------------------------------------------------------
-- Route Edges policies
-- ------------------------------------------------------------

create policy "organization owners can manage route edges"
on public.route_edges
for all
to authenticated
using (
  public.is_floor_owner(floor_id)
)
with check (
  public.is_floor_owner(floor_id)
);

create policy "public can read edges from published floors"
on public.route_edges
for select
to anon, authenticated
using (
  public.is_floor_published(floor_id)
);


-- ------------------------------------------------------------
-- Storage bucket
-- ------------------------------------------------------------
-- Current frontend uses the bucket name "plan-images".
-- Keep it private and use signed URLs.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'plan-images',
  'plan-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ------------------------------------------------------------
-- Storage policies
-- ------------------------------------------------------------

drop policy if exists "owners can upload plan images" on storage.objects;
drop policy if exists "owners can read own plan images and public can read published plan images" on storage.objects;
drop policy if exists "owners can update own plan images" on storage.objects;
drop policy if exists "owners can delete own plan images" on storage.objects;


-- Users may upload only inside:
-- plan-images/{user_id}/{floor_id}/filename.ext
create policy "owners can upload plan images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'plan-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- Owners can read their own files.
-- Public users can read only images attached to published floors.
create policy "owners can read own plan images and public can read published plan images"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'plan-images'
  and (
    (auth.role() = 'authenticated' and (storage.foldername(name))[1] = auth.uid()::text)
    or
    exists (
      select 1
      from public.floors f
      where f.plan_image_path = storage.objects.name
        and f.status = 'published'
    )
  )
);


create policy "owners can update own plan images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'plan-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'plan-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);


create policy "owners can delete own plan images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'plan-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);