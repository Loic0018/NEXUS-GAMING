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


-- Extensions du profil joueur : avatar, statistiques et historique des parties
alter table public.player_profiles
  add column if not exists avatar_url text,
  add column if not exists xp integer not null default 0,
  add column if not exists matches_played integer not null default 0,
  add column if not exists wins integer not null default 0;

create table if not exists public.game_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users(id) on delete cascade,
  game_name text not null,
  result text not null check (result in ('Victoire','Défaite','Égalité')),
  xp_earned integer not null default 0,
  played_at timestamptz not null default now()
);

alter table public.game_history enable row level security;
drop policy if exists "Les joueurs voient leur historique" on public.game_history;
drop policy if exists "Les joueurs ajoutent leurs parties" on public.game_history;
drop policy if exists "Les joueurs suppriment leurs parties" on public.game_history;

create policy "Les joueurs voient leur historique"
  on public.game_history for select using (auth.uid() = player_id);
create policy "Les joueurs ajoutent leurs parties"
  on public.game_history for insert with check (auth.uid() = player_id);
create policy "Les joueurs suppriment leurs parties"
  on public.game_history for delete using (auth.uid() = player_id);

-- Mise à jour automatique des statistiques lorsqu'un résultat est enregistré
create or replace function public.update_nexus_player_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.player_profiles
  set xp = xp + new.xp_earned,
      matches_played = matches_played + 1,
      wins = wins + case when new.result = 'Victoire' then 1 else 0 end
  where id = new.player_id;
  return new;
end;
$$;

drop trigger if exists nexus_update_stats_after_match on public.game_history;
create trigger nexus_update_stats_after_match
after insert on public.game_history
for each row execute function public.update_nexus_player_stats();

-- Espace public pour les photos de profil
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Photos de profil visibles par tous" on storage.objects;
drop policy if exists "Chaque joueur envoie sa photo" on storage.objects;
drop policy if exists "Chaque joueur modifie sa photo" on storage.objects;
drop policy if exists "Chaque joueur supprime sa photo" on storage.objects;

create policy "Photos de profil visibles par tous"
  on storage.objects for select using (bucket_id = 'avatars');
create policy "Chaque joueur envoie sa photo"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Chaque joueur modifie sa photo"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Chaque joueur supprime sa photo"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
