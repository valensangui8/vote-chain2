"use client";

import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  privy_user_id: string;
  role: string;
};

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch("/api/elections");
      // Placeholder: fetch users when endpoint exists. For now we just stop loading.
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10 px-6 mt-16">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-2">
          <span className="text-xs font-mono text-indigo-400">ADMIN CONSOLE</span>
        </div>
        <h1 className="text-3xl font-bold text-white">System overview & roles</h1>
        <p className="text-sm text-slate-400">Stubbed data; connect to Supabase and Privy admin flags.</p>
      </header>

      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white">Users</h3>
        <p className="text-sm text-slate-400">Awaiting Supabase query hook.</p>
        <div className="mt-4 rounded-lg border border-dashed border-white/20 p-4 text-sm text-slate-400 bg-white/5">
          {loading ? "Loading..." : "Connect Supabase service role to list users and promote organizers."}
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white">System health</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          <li className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${process.env.NEXT_PUBLIC_RPC_URL ? "bg-green-500" : "bg-red-500"}`} />
            RPC: {process.env.NEXT_PUBLIC_RPC_URL ? "configured" : "missing"}
          </li>
          <li className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${process.env.NEXT_PUBLIC_VOTING_CONTRACT ? "bg-green-500" : "bg-red-500"}`} />
            Voting contract: {process.env.NEXT_PUBLIC_VOTING_CONTRACT ? "configured" : "missing"}
          </li>
          <li className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${process.env.NEXT_PUBLIC_PAYMASTER_RPC_URL ? "bg-green-500" : "bg-red-500"}`} />
            Paymaster: {process.env.NEXT_PUBLIC_PAYMASTER_RPC_URL ? "configured" : "missing"}
          </li>
          <li className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${process.env.NEXT_PUBLIC_SUPABASE_URL ? "bg-green-500" : "bg-red-500"}`} />
            Supabase: {process.env.NEXT_PUBLIC_SUPABASE_URL ? "configured" : "missing"}
          </li>
        </ul>
      </div>
    </div>
  );
}


