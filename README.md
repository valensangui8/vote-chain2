# VoteChain - Anonymous Blockchain Voting System

A secure, anonymous voting system built on Ethereum (Sepolia testnet) using **Zero-Knowledge Proofs (Semaphore Protocol)**, **Privy Smart Wallets** with gasless transactions, and **Supabase** for off-chain coordination.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              VoteChain Architecture                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │   Frontend      │    │   Supabase      │    │   Ethereum (Sepolia)        │ │
│  │   (Next.js)     │    │   (PostgreSQL)  │    │   Smart Contracts           │ │
│  │                 │    │                 │    │                             │ │
│  │  - Voter UI     │◄──►│  - Users        │    │  - Voting.sol               │ │
│  │  - Organizer UI │    │  - Elections    │◄──►│  - GroupManager.sol         │ │
│  │  - Admin UI     │    │  - Candidates   │    │  - SemaphoreWrapper.sol     │ │
│  │                 │    │  - Invitations  │    │  - Verifier.sol             │ │
│  └────────┬────────┘    │  - Votes        │    │                             │ │
│           │             └─────────────────┘    └──────────────┬──────────────┘ │
│           │                                                   │                 │
│           │              ┌─────────────────┐                  │                 │
│           │              │   Privy         │                  │                 │
│           └─────────────►│   Auth + Smart  │◄─────────────────┘                 │
│                          │   Wallets       │                                    │
│                          │                 │                                    │
│                          │  - Email/Google │                                    │
│                          │  - Smart Wallet │                                    │
│                          │  - Paymaster    │                                    │
│                          └─────────────────┘                                    │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                      Semaphore Protocol (ZK)                              │  │
│  │                                                                            │  │
│  │  - Identity Generation (Client-side)                                       │  │
│  │  - Commitment Storage (On-chain Merkle Tree)                               │  │
│  │  - ZK Proof Generation (Client-side via snarkjs)                          │  │
│  │  - Proof Verification (On-chain via Verifier contract)                    │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 🔑 Key Technologies

### 1. Blockchain (Ethereum Sepolia)

The voting system uses four smart contracts deployed on Sepolia testnet:

| Contract | Purpose |
|----------|---------|
| **Voting.sol** | Main contract for election management, vote casting, and result tallying |
| **GroupManager.sol** | Manages Semaphore groups per election, handles voter commitments |
| **SemaphoreWrapper.sol** | Light wrapper around Semaphore protocol for group management |
| **Verifier.sol** | Adapter for Semaphore's Groth16 proof verification |

### 2. Zero-Knowledge Proofs (Semaphore Protocol)

Semaphore enables **anonymous group membership verification**. Voters can prove they belong to an election's voter group without revealing their identity.

**Key Concepts:**
- **Identity**: A cryptographic keypair generated client-side from a random seed
- **Commitment**: A hash of the identity (stored on-chain in a Merkle tree)
- **Nullifier**: A unique value per vote that prevents double-voting
- **ZK Proof**: A Groth16 proof that proves:
  1. The voter's commitment exists in the Merkle tree
  2. The nullifier was computed correctly
  3. The signal (vote) is authentic

### 3. Privy Authentication & Smart Wallets

Privy provides:
- **Social Login**: Email and Google authentication
- **Embedded Wallets**: Automatic wallet creation for new users
- **Smart Wallets**: ERC-4337 account abstraction wallets
- **Paymaster Integration**: Gas sponsorship via Pimlico for gasless transactions

### 4. Supabase (Off-chain Coordination)

PostgreSQL database for:
- User management and role-based access
- Election metadata and configuration
- Candidate information
- Voter invitations and commitment tracking
- Vote audit logs (nullifiers, signals, tx hashes)

## 👥 User Roles

| Role | Capabilities |
|------|--------------|
| **Admin** | System administration, user management (Coming soon) |
| **Organizer** | Create elections, add candidates, invite voters, view results |
| **Voter** | Accept invitations, cast anonymous votes |

## 🔄 System Flows

### Flow 1: Election Creation (Organizer)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│  Organizer   │     │   Frontend   │     │  Smart Contracts     │
└──────┬───────┘     └──────┬───────┘     └──────────┬───────────┘
       │                    │                        │
       │ 1. Create Election │                        │
       │───────────────────►│                        │
       │                    │                        │
       │                    │ 2. registerElectionGroup()
       │                    │───────────────────────►│ GroupManager
       │                    │                        │ (creates Semaphore group)
       │                    │                        │
       │                    │ 3. createElection()    │
       │                    │───────────────────────►│ Voting
       │                    │                        │ (stores election params)
       │                    │                        │
       │                    │ 4. addCandidate() x N  │
       │                    │───────────────────────►│ Voting
       │                    │                        │
       │                    │ 5. Save to Supabase    │
       │                    │◄───────────────────────│
       │◄───────────────────│                        │
       │  Election Ready    │                        │
```

**On-Chain Data Stored:**
- Election ID, Group ID, External Nullifier
- Start/End timestamps
- Candidate names and images
- Owner address

**Supabase Data Stored:**
- Election metadata (name, dates, status)
- On-chain IDs mapping
- Candidates (duplicated for fast queries)

### Flow 2: Voter Invitation & Registration

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│   Voter      │     │   Frontend   │     │  Smart Contracts     │
└──────┬───────┘     └──────┬───────┘     └──────────┬───────────┘
       │                    │                        │
       │ 1. Login (Privy)   │                        │
       │───────────────────►│                        │
       │                    │                        │
       │ 2. Generate Identity (seed in localStorage) │
       │                    │────────────────────────│
       │                    │   commitment = hash(identity)
       │                    │                        │
       │ 3. Accept Invite   │                        │
       │───────────────────►│                        │
       │                    │                        │
       │                    │ 4. Update Supabase     │
       │                    │    (status=accepted,   │
       │                    │     commitment_hash)   │
       │                    │                        │
       │                    │ 5. addCommitment()     │
       │                    │───────────────────────►│ GroupManager
       │                    │                        │ (adds to Merkle tree)
       │◄───────────────────│                        │
       │  Registered ✓      │                        │
```

**Identity Generation (Client-Side):**
```typescript
// Using @semaphore-protocol/identity
const seed = localStorage.getItem("voter_seed") || generateRandomSeed();
const identity = new Identity(seed);
const commitment = identity.commitment; // BigInt stored on-chain
```

### Flow 3: Anonymous Vote Casting

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│   Voter      │     │   Frontend   │     │  Smart Contracts     │
└──────┬───────┘     └──────┬───────┘     └──────────┬───────────┘
       │                    │                        │
       │ 1. Select Candidate│                        │
       │───────────────────►│                        │
       │                    │                        │
       │                    │ 2. Fetch all commitments
       │                    │    from Supabase       │
       │                    │                        │
       │                    │ 3. Build local Merkle Tree
       │                    │    (Semaphore Group)   │
       │                    │                        │
       │                    │ 4. Generate ZK Proof   │
       │                    │    - identity (from localStorage)
       │                    │    - group (Merkle tree)
       │                    │    - signal (candidateId)
       │                    │    - externalNullifier │
       │                    │                        │
       │                    │ 5. castVote()          │
       │                    │───────────────────────►│ Voting
       │                    │                        │
       │                    │                        │ 6. verifyProof()
       │                    │                        │ (via Semaphore)
       │                    │                        │
       │                    │                        │ 7. Check !nullifierUsed
       │                    │                        │
       │                    │                        │ 8. Increment voteCount
       │                    │                        │    Mark nullifier used
       │                    │                        │
       │                    │ 9. Save to Supabase    │
       │                    │    (audit log)         │
       │◄───────────────────│                        │
       │  Vote Cast ✓       │                        │
```

**ZK Proof Generation (Client-Side):**
```typescript
// Using @semaphore-protocol/proof
const fullProof = await generateProof(
  identity,      // Voter's secret identity
  group,         // Local Merkle tree with all commitments
  signal,        // Candidate ID being voted for
  scope,         // External nullifier (election-specific)
  20             // Merkle tree depth
);

// The proof contains:
// - nullifier: unique per (identity, scope) - prevents double voting
// - merkleTreeRoot: proves membership
// - points: Groth16 proof array [8 elements]
```

**On-Chain Verification:**
```solidity
function castVote(..., uint256[8] calldata proof) external {
    // 1. Verify election is active
    // 2. Check nullifier not used
    // 3. Verify ZK proof via Semaphore
    semaphore.verifyProof(groupId, depth, signal, nullifierHash, externalNullifier, proof);
    // 4. Mark nullifier as used
    // 5. Increment candidate vote count
}
```

### Flow 4: Results Retrieval

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│  Organizer   │     │   Frontend   │     │  Smart Contracts     │
└──────┬───────┘     └──────┬───────┘     └──────────┬───────────┘
       │                    │                        │
       │ 1. View Results    │                        │
       │───────────────────►│                        │
       │                    │                        │
       │                    │ 2. getCandidates()     │
       │                    │───────────────────────►│ Voting
       │                    │                        │
       │                    │◄───────────────────────│
       │                    │  [{id, name, voteCount}]
       │                    │                        │
       │◄───────────────────│                        │
       │  Display Results   │                        │
```

## 📁 Project Structure

```
vote-chain2/
├── contracts/                    # Solidity smart contracts
│   ├── Voting.sol               # Main voting contract
│   ├── GroupManager.sol         # Semaphore group management
│   ├── SemaphoreWrapper.sol     # Semaphore wrapper
│   ├── Verifier.sol             # ZK proof verifier adapter
│   └── Interfaces.sol           # Contract interfaces
│
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── page.tsx            # Landing/Dashboard
│   │   ├── voter/              # Voter portal
│   │   │   ├── page.tsx        # Invitations list
│   │   │   └── election/[id]/  # Vote casting page
│   │   ├── organizer/          # Organizer dashboard
│   │   │   └── page.tsx        # Election management
│   │   └── admin/              # Admin panel (WIP)
│   │
│   ├── lib/
│   │   ├── ethers/             # Blockchain utilities
│   │   │   ├── config.ts       # Contract addresses
│   │   │   └── contracts.ts    # Contract ABIs
│   │   │
│   │   ├── privy/              # Authentication
│   │   │   ├── provider.tsx    # Privy + Smart Wallets setup
│   │   │   ├── wallet.ts       # Smart wallet transaction helper
│   │   │   ├── paymaster.ts    # Gas sponsorship config
│   │   │   └── roles.ts        # Role-based access helpers
│   │   │
│   │   ├── supabase/           # Database client
│   │   │   ├── client.ts       # Browser client
│   │   │   └── server.ts       # Server client (service role)
│   │   │
│   │   ├── zk/                 # Zero-knowledge utilities
│   │   │   └── semaphore.ts    # Identity, proof generation
│   │   │
│   │   └── utils/
│   │       └── ids.ts          # On-chain ID generators
│   │
│   └── pages/api/              # Next.js API Routes
│       ├── elections/          # Election CRUD
│       ├── candidates/         # Candidate management
│       ├── invitations/        # Voter invitations
│       ├── votes/              # Vote recording (audit)
│       └── users/              # User management
│
├── public/zk/semaphore/        # ZK circuit artifacts (optional)
│   ├── semaphore.wasm
│   └── semaphore.zkey
│
└── supabase.schema.sql         # Database schema
```

## 🗄️ Database Schema

```sql
-- Users linked to Privy authentication
users (
  id UUID PRIMARY KEY,
  privy_user_id TEXT UNIQUE,
  role TEXT ('admin'|'organizer'|'voter'),
  created_at TIMESTAMPTZ
)

-- Election metadata
elections (
  id UUID PRIMARY KEY,
  name TEXT,
  owner_id UUID → users(id),
  onchain_election_id TEXT UNIQUE,  -- Links to smart contract
  onchain_group_id TEXT,            -- Semaphore group ID
  external_nullifier TEXT,          -- For ZK proofs
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status TEXT ('draft'|'active'|'ended')
)

-- Candidates per election
candidates (
  id UUID PRIMARY KEY,
  election_id UUID → elections(id),
  name TEXT,
  image_url TEXT,
  vote_count INTEGER  -- Cached, source of truth is on-chain
)

-- Voter invitations
invitations (
  id UUID PRIMARY KEY,
  election_id UUID → elections(id),
  invitee_email TEXT,
  status TEXT ('pending'|'accepted'|'rejected'),
  commitment_hash TEXT,  -- ZK identity commitment
  accepted_at TIMESTAMPTZ
)

-- Vote audit log (source of truth is on-chain)
votes (
  id UUID PRIMARY KEY,
  election_id UUID → elections(id),
  nullifier_hash TEXT UNIQUE,  -- Prevents double voting
  signal TEXT,                 -- Candidate voted for
  tx_hash TEXT                 -- Blockchain transaction
)
```

## ⚙️ Environment Variables

```env
# Privy Authentication
NEXT_PUBLIC_PRIVY_APP_ID=         # Privy App ID
PRIVY_APP_SECRET=                 # Privy secret (server-side)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Public anon key
SUPABASE_SERVICE_ROLE_KEY=        # Service role key (server-side)

# Ethereum (Sepolia)
NEXT_PUBLIC_RPC_URL=              # Sepolia RPC endpoint
NEXT_PUBLIC_VOTING_CONTRACT=      # Voting.sol address
NEXT_PUBLIC_GROUP_MANAGER_CONTRACT=  # GroupManager.sol address
NEXT_PUBLIC_SEMAPHORE_ADDRESS=    # Semaphore contract address
NEXT_PUBLIC_SEMAPHORE_VERIFIER=   # Verifier contract address

# Paymaster (Gasless Transactions)
NEXT_PUBLIC_PIMLICO_API_KEY=      # Pimlico API key
NEXT_PUBLIC_PAYMASTER_RPC_URL=    # Paymaster RPC URL
```

## 🔒 Security Model

### Privacy Guarantees

| Property | Mechanism |
|----------|-----------|
| **Voter Anonymity** | ZK proofs hide which commitment cast the vote |
| **Vote Secrecy** | Only the signal (candidate ID) is revealed, not voter identity |
| **Ballot Integrity** | On-chain verification ensures votes are valid |
| **No Double Voting** | Nullifiers are unique per (identity, election) |

### Trust Assumptions

1. **Organizer Trust**: Organizers control who gets invited
2. **Smart Contract Trust**: Contracts must be deployed correctly
3. **Semaphore Protocol**: Relies on Groth16 soundness
4. **Privy/Paymaster**: Trusted for authentication and gas sponsorship

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Privy account and app
- Supabase project
- Ethereum wallet with Sepolia ETH (for contract deployment)
- Pimlico account (for paymaster)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/vote-chain2.git
cd vote-chain2

# Install dependencies
npm install

# Copy environment file
cp env.example .env.local
# Edit .env.local with your configuration

# Run full setup (download ZK artifacts + compile contracts)
npm run setup

# Verify everything is configured correctly
npm run verify:setup

# Run development server
npm run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production (includes compile) |
| `npm run compile` | Compile contracts and generate ABIs |
| `npm run download:zk` | Download Semaphore ZK circuit artifacts |
| `npm run verify:setup` | Verify all components are properly configured |
| `npm run setup` | Run full setup (download:zk + compile) |
| `npm run deploy:sepolia` | Deploy contracts to Sepolia testnet |

### Contract Deployment

```bash
# 1. Set your deployer private key in .env.local
DEPLOYER_PRIVATE_KEY=0x...

# 2. Deploy to Sepolia
npm run deploy:sepolia

# 3. Update .env.local with the displayed contract addresses
```

The official Semaphore contract on Sepolia is already deployed at:
`0x1e0d7FF1610e480fC93BdEC510811ea2Ba6d7c2f`

## 📊 Transaction Flow Summary

| Action | Contract | Function | Gas Sponsor |
|--------|----------|----------|-------------|
| Create Election | GroupManager | `registerElectionGroup()` | Paymaster |
| Create Election | Voting | `createElection()` | Paymaster |
| Add Candidate | Voting | `addCandidate()` | Paymaster |
| Accept Invitation | GroupManager | `addCommitment()` | Paymaster |
| Cast Vote | Voting | `castVote()` | Paymaster |
| Get Results | Voting | `getCandidates()` | N/A (view) |

## 🔧 Technical Notes

### Semaphore Version

This project uses **Semaphore v4.14** with:
- Fixed Merkle tree depth of 20
- Automatic artifact download from PSE CDN
- `@semaphore-protocol/identity`, `@semaphore-protocol/group`, `@semaphore-protocol/proof`

### Smart Wallet Transactions

Transactions are sent via Privy's Smart Wallet (ERC-4337):
1. User signs operation with embedded wallet
2. Smart wallet wraps into UserOp
3. Bundler submits to network
4. Paymaster sponsors gas

This can result in slightly longer confirmation times compared to direct transactions.

## 📝 License

MIT License

---

Built with ❤️ using Next.js, Semaphore Protocol, Privy, and Supabase
