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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">Admin</p>
        <h1 className="text-3xl font-bold text-slate-900">System overview & roles</h1>
        <p className="text-sm text-slate-600">Stubbed data; connect to Supabase and Privy admin flags.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Users</h3>
        <p className="text-sm text-slate-600">Awaiting Supabase query hook.</p>
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-600">
          {loading ? "Loading..." : "Connect Supabase service role to list users and promote organizers."}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">System health</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>• RPC: {process.env.NEXT_PUBLIC_RPC_URL ? "configured" : "missing"}</li>
          <li>• Voting contract: {process.env.NEXT_PUBLIC_VOTING_CONTRACT ? "configured" : "missing"}</li>
          <li>
            • Paymaster: {process.env.NEXT_PUBLIC_PAYMASTER_RPC_URL ? "configured" : "missing"}
          </li>
          <li>• Supabase: {process.env.NEXT_PUBLIC_SUPABASE_URL ? "configured" : "missing"}</li>
        </ul>
      </section>
    </div>
  );
}


