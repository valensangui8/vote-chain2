"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";

export default function Home() {
  const { authenticated, ready, login } = usePrivy();

  // Show dashboard for logged-in users
  if (authenticated && ready) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-14">
          <header className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">
              Welcome to VoteChain
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 mt-2">
              Choose Your Role
            </h1>
            <p className="mt-3 text-lg text-slate-600">
              Select how you&apos;d like to participate in anonymous voting
            </p>
          </header>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Voter Card */}
            <Link
              href="/voter"
              className="group rounded-2xl border-2 border-slate-200 bg-white p-8 shadow-sm transition hover:border-indigo-400 hover:shadow-lg"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-slate-900 transition group-hover:text-indigo-600">
                Vote
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                View your election invitations and cast anonymous votes using zero-knowledge proofs. Your identity remains private.
              </p>
              <div className="mt-6 flex items-center text-sm font-semibold text-indigo-600">
                Go to Voter Portal
                <svg className="ml-2 h-4 w-4 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            {/* Organizer Card */}
            <Link
              href="/organizer"
              className="group rounded-2xl border-2 border-slate-200 bg-white p-8 shadow-sm transition hover:border-indigo-400 hover:shadow-lg"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-purple-100 text-purple-600 transition group-hover:bg-purple-600 group-hover:text-white">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-slate-900 transition group-hover:text-purple-600">
                Organize
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Create elections, add candidates, invite voters, and manage your voting events. Track results and participation.
              </p>
              <div className="mt-6 flex items-center text-sm font-semibold text-purple-600">
                Go to Organizer Console
                <svg className="ml-2 h-4 w-4 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            {/* Admin Card */}
            <Link
              href="/admin"
              className="group rounded-2xl border-2 border-slate-200 bg-white p-8 shadow-sm transition hover:border-slate-400 hover:shadow-lg opacity-70"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-slate-600 group-hover:text-white">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-slate-900 transition group-hover:text-slate-600">
                Admin
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                System administration and user management. Monitor platform health and manage organizer permissions. (Coming soon)
              </p>
              <div className="mt-6 flex items-center text-sm font-semibold text-slate-600">
                Go to Admin Dashboard
                <svg className="ml-2 h-4 w-4 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Show landing page for non-logged-in users
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-14">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">
              zk + AA + Paymaster
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              VoteChain — anonymous, gasless voting on Sepolia
            </h1>
            <p className="mt-3 max-w-3xl text-lg text-slate-600">
              Semaphore-backed membership, Privy smart wallets, paymaster gas
              sponsorship, and Supabase coordination in a single scaffold.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => login()}
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              Sign in to get started
            </button>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Semaphore zk membership",
              body: "Generate identities client-side, store commitments, and verify proofs on-chain with wrapper contracts.",
            },
            {
              title: "Privy smart wallets + paymaster",
              body: "Kernel wallets, Pimlico/Privy paymaster hooks, and email/Google login with enforced organizer roles.",
            },
            {
              title: "Supabase coordination",
              body: "Persist election metadata, candidates, and vote nullifiers with simple API stubs ready to wire.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">
              What&apos;s inside
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>• Contracts: Semaphore wrapper, Voting, Verifier, GroupManager</li>
              <li>• API stubs for auth, elections, candidates, votes, zk proofs</li>
              <li>• Lib helpers for Privy, Supabase, Ethers, and Semaphore proofs</li>
              <li>• Organizer/Voter/Admin pages with starter flows and UI states</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-indigo-900">
              Next steps
            </h3>
            <p className="mt-3 text-sm text-indigo-800">
              Replace placeholder addresses/keys, deploy contracts to Sepolia,
              configure paymaster, and connect API routes to Supabase and
              Privy. Hooks are annotated where wiring is needed.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                href="/organizer"
              >
                Start with elections
              </a>
              <a
                className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-800 transition hover:bg-white"
                href="/voter"
              >
                Test zk voting
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
