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
  -- NOTE: commitment_hash is intentionally NOT stored to preserve voter anonymity.
  -- The commitment only exists on-chain where it cannot be linked to email/identity.
  -- This prevents correlation attacks between invitations and votes.
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
  -- NOTE: voter_privy_user_id is intentionally NOT stored to preserve voter anonymity.
  -- The nullifier_hash is sufficient to prevent double voting without revealing identity.
  -- NOTE: tx_hash is NOT stored to prevent linkage via Privy + Supabase admin attack.
  -- Users see tx_hash on-screen once for verification; it is not persisted.
  nullifier_hash text unique not null,
  signal text not null,  -- The vote choice (candidate ID)
  created_at timestamptz default now()
);

comment on table users is 'Privy-linked identities with role-based access';
comment on table elections is 'Election metadata anchored to semaphore group';
comment on table candidates is 'Candidates tied to elections';
comment on table invitations is 'Voter invitations - commitment NOT stored to preserve anonymity';
comment on table votes is 'Anonymous vote records - only nullifier/signal stored, no voter identity';

-- ANONYMITY NOTES:
-- 1. commitment_hash is NOT stored in invitations to prevent identity correlation
-- 2. voter_privy_user_id is NOT stored in votes to prevent tracking who voted for whom
-- 3. The ZK commitment only exists on-chain where it cannot be linked to email/identity
-- 4. The nullifier prevents double-voting without revealing voter identity

