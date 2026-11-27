-- NEXUS-GAMING : table de profils joueurs
-- À exécuter dans Supabase > SQL Editor.
-- Les comptes sont gérés par Supabase Auth ; aucun trigger SQL n'est nécessaire ici.

create table if not exists public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 20),
  created_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;

drop policy if exists "Les profils sont visibles par tous" on public.player_profiles;
drop policy if exists "Chaque joueur peut créer son profil" on public.player_profiles;
drop policy if exists "Chaque joueur peut modifier son profil" on public.player_profiles;

create policy "Les profils sont visibles par tous"
  on public.player_profiles for select using (true);

create policy "Chaque joueur peut créer son profil"
  on public.player_profiles for insert with check (auth.uid() = id);

create policy "Chaque joueur peut modifier son profil"
  on public.player_profiles for update using (auth.uid() = id) with check (auth.uid() = id);
