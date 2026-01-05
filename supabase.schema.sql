-- Supabase schema for zk voting scaffold

create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text unique not null,
  role text check (role in ('admin','organizer','voter')) default 'voter',
  created_at timestamptz default now()
);

create table if not exists elections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references users(id),
  semaphore_group_id text,
  onchain_election_id text unique not null,
  onchain_group_id text not null,
  external_nullifier text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  is_public boolean default false,
  status text check (status in ('draft','active','ended')) default 'draft',
  created_at timestamptz default now()
);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references elections(id) on delete cascade,
  inviter_id uuid references users(id),
  invitee_email text not null,
  invitee_privy_user_id text,
  status text check (status in ('pending','accepted','rejected')) default 'pending',
  commitment_hash text,
  created_at timestamptz default now(),
  accepted_at timestamptz,
  unique(election_id, invitee_email)
);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references elections(id) on delete cascade,
  name text not null,
  image_url text,
  vote_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references elections(id) on delete cascade,
  voter_privy_user_id text,
  nullifier_hash text unique not null,
  signal text not null,
  tx_hash text,
  created_at timestamptz default now()
);

comment on table users is 'Privy-linked identities with role-based access';
comment on table elections is 'Election metadata anchored to semaphore group';
comment on table candidates is 'Candidates tied to elections';
comment on table votes is 'Off-chain record of vote signals/nullifiers for auditing';

