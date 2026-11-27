-- NEXUS-GAMING : table de profils joueurs
-- À exécuter dans Supabase > SQL Editor.
create table if not exists public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 20),
  created_at timestamptz not null default now()
);
alter table public.player_profiles enable row level security;
create policy "Les profils sont visibles par tous"
  on public.player_profiles for select using (true);
create policy "Chaque joueur peut créer son profil"
  on public.player_profiles for insert with check (auth.uid() = id);
create policy "Chaque joueur peut modifier son profil"
  on public.player_profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create or replace function public.handle_new_nexus_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.player_profiles (id, username)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'username',''), split_part(new.email,'@',1)));
  return new;
end;
$$;
drop trigger if exists on_nexus_user_created on auth.users;
create trigger on_nexus_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_nexus_user();
