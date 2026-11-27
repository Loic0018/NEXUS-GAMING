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


-- Sécurisation des résultats : les XP sont calculés par la base, jamais par le navigateur.
create or replace function public.set_nexus_match_xp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.xp_earned := case new.result
    when 'Victoire' then 100
    when 'Égalité' then 40
    when 'Défaite' then 10
  end;
  return new;
end;
$$;

drop trigger if exists nexus_set_match_xp_before_insert on public.game_history;
create trigger nexus_set_match_xp_before_insert
before insert on public.game_history
for each row execute function public.set_nexus_match_xp();

grant select, insert on table public.game_history to authenticated;
grant select on table public.player_profiles to anon, authenticated;
 
-- Tournois NEXUS : catalogue public et inscriptions des joueurs
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  game_name text not null,
  format text not null,
  team_size integer not null default 1 check (team_size >= 1),
  status text not null default 'upcoming' check (status in ('upcoming','open','closed','completed')),
  description text not null default '',
  prize_label text not null default 'Récompense à définir',
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  team_name text not null check (char_length(team_name) between 2 and 40),
  registered_at timestamptz not null default now(),
  unique (tournament_id, player_id)
);

alter table public.tournaments enable row level security;
alter table public.tournament_registrations enable row level security;

drop policy if exists "Les tournois sont visibles par tous" on public.tournaments;
create policy "Les tournois sont visibles par tous"
  on public.tournaments for select using (true);

drop policy if exists "Les inscriptions sont visibles par tous" on public.tournament_registrations;
create policy "Les inscriptions sont visibles par tous"
  on public.tournament_registrations for select using (true);

drop policy if exists "Un joueur peut inscrire sa propre équipe" on public.tournament_registrations;
create policy "Un joueur peut inscrire sa propre équipe"
  on public.tournament_registrations for insert to authenticated
  with check (auth.uid() = player_id);

grant select on public.tournaments to anon, authenticated;
grant select on public.tournament_registrations to anon, authenticated;
grant insert on public.tournament_registrations to authenticated;

insert into public.tournaments (slug, name, game_name, format, team_size, status, description, prize_label)
values (
  'cyber-strike-cup',
  'Cyber Strike Cup',
  'Cyber Strike',
  'FPS · 5 contre 5',
  5,
  'open',
  'Forme ton équipe et affronte les autres squads dans la première compétition NEXUS.',
  'Récompense fictive : 50 000 FCFA'
)
on conflict (slug) do update set
  name = excluded.name,
  game_name = excluded.game_name,
  format = excluded.format,
  team_size = excluded.team_size,
  status = excluded.status,
  description = excluded.description,
  prize_label = excluded.prize_label;


-- Composition des équipes du Cyber Strike Cup : quatre équipiers en plus du capitaine
create table if not exists public.tournament_team_members (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.tournament_registrations(id) on delete cascade,
  slot integer not null check (slot between 1 and 4),
  player_name text not null check (char_length(player_name) between 2 and 24),
  created_at timestamptz not null default now(),
  unique (registration_id, slot),
  unique (registration_id, player_name)
);

alter table public.tournament_team_members enable row level security;

drop policy if exists "Les compositions sont visibles par tous" on public.tournament_team_members;
create policy "Les compositions sont visibles par tous"
  on public.tournament_team_members for select using (true);

drop policy if exists "Le capitaine gère sa composition" on public.tournament_team_members;
create policy "Le capitaine gère sa composition"
  on public.tournament_team_members for all to authenticated
  using (
    exists (
      select 1 from public.tournament_registrations r
      where r.id = registration_id and r.player_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tournament_registrations r
      where r.id = registration_id and r.player_id = auth.uid()
    )
  );

grant select on public.tournament_team_members to anon, authenticated;
grant insert, update, delete on public.tournament_team_members to authenticated;
