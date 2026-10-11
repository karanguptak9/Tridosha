-- Tridosha hosted build: accounts own profiles, profiles own documents.
-- Run once in the Supabase SQL editor (or with `supabase db push`).

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);
create index if not exists profiles_user_idx on public.profiles (user_id, created_at);

-- One row per saved document of a profile: 'profile', 'prakriti', 'vikriti',
-- 'saved', 'plan', and month buckets 'meals-YYYY-MM' / 'checkins-YYYY-MM'.
create table if not exists public.documents (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  doc_id text not null check (doc_id ~ '^[a-z0-9-]{1,40}$'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, doc_id)
);
create index if not exists documents_user_idx on public.documents (user_id);

alter table public.profiles enable row level security;
alter table public.documents enable row level security;

-- A signed-in user sees and changes only their own rows.
drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists documents_own on public.documents;
create policy documents_own on public.documents for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = auth.uid())
  );

-- At most 12 profiles per account.
create or replace function public.profiles_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.profiles where user_id = new.user_id) >= 12 then
    raise exception 'Profile limit reached (12 per account)';
  end if;
  return new;
end $$;
drop trigger if exists profiles_limit on public.profiles;
create trigger profiles_limit before insert on public.profiles
  for each row execute function public.profiles_limit();

-- Lets a signed-in user delete their own account; profiles and documents cascade.
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
