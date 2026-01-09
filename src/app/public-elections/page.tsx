"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Election = {
  id: string;
  name: string;
  status: string;
  ends_at: string | null;
  is_public: boolean;
  onchain_election_id: string;
};

export default function PublicElectionsPage() {
  const router = useRouter();
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "ended">("all");

  useEffect(() => {
    fetchPublicElections();
  }, []);

  async function fetchPublicElections() {
    try {
      setLoading(true);
      const res = await fetch("/api/elections");
      const data = await res.json();

      if (res.ok) {
        // Filter only public elections
        const publicElections = (data.elections || []).filter((e: Election) => e.is_public);
        setElections(publicElections);
      }
    } catch (err) {
      console.error("Error fetching elections:", err);
    } finally {
      setLoading(false);
    }
  }

  function hasElectionEnded(election: Election): boolean {
    if (election.status === "ended") return true;
    if (election.ends_at) {
      return new Date(election.ends_at).getTime() <= new Date().getTime();
    }
    return false;
  }

  function isElectionActive(election: Election): boolean {
    if (election.status === "ended") return false;
    if (election.ends_at) {
      return new Date(election.ends_at).getTime() > new Date().getTime();
    }
    return true;
  }

  const filteredElections = elections.filter((e) => {
    if (filter === "active") return isElectionActive(e);
    if (filter === "ended") return hasElectionEnded(e);
    return true;
  });

  const activeElections = filteredElections.filter(isElectionActive);
  const endedElections = filteredElections.filter(hasElectionEnded);

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10 px-6 mt-16">
        <div className="glass rounded-2xl p-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded w-1/2 mx-auto"></div>
            <div className="h-4 bg-white/10 rounded w-1/3 mx-auto"></div>
          </div>
          <p className="text-slate-400 mt-4">Loading public elections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10 px-6 mt-16">
      {/* Header */}
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 mb-2">
          <span className="text-xs font-mono text-green-400">PUBLIC ELECTIONS</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Browse Public Elections</h1>
        <p className="text-sm text-slate-400">
          View and participate in public elections. Anyone can see the results of these elections.
        </p>
      </header>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 text-sm font-medium transition ${
            filter === "all"
              ? "border-b-2 border-green-500 text-green-400"
              : "text-slate-400 hover:text-white"
          }`}
        >
          All ({elections.length})
        </button>
        <button
          onClick={() => setFilter("active")}
          className={`px-4 py-2 text-sm font-medium transition ${
            filter === "active"
              ? "border-b-2 border-green-500 text-green-400"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Active ({activeElections.length})
        </button>
        <button
          onClick={() => setFilter("ended")}
          className={`px-4 py-2 text-sm font-medium transition ${
            filter === "ended"
              ? "border-b-2 border-green-500 text-green-400"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Ended ({endedElections.length})
        </button>
      </div>

      {/* Elections List */}
      {filteredElections.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border-dashed border-white/20">
          <p className="text-slate-400">
            {filter === "all" 
              ? "No public elections available yet" 
              : `No ${filter} public elections`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredElections.map((election) => {
            const ended = hasElectionEnded(election);
            const active = isElectionActive(election);

            return (
              <div
                key={election.id}
                className="glass rounded-xl p-6 border border-white/10 hover:border-green-500/50 transition-all group cursor-pointer"
                onClick={() => router.push(ended ? `/results/${election.id}` : `/elections/${election.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white group-hover:text-green-300 transition-colors">
                      {election.name}
                    </h3>
                    {election.ends_at && (
                      <p className="text-sm text-slate-400 mt-1">
                        {ended 
                          ? `Ended: ${new Date(election.ends_at).toLocaleDateString()}` 
                          : active
                          ? `Ends: ${new Date(election.ends_at).toLocaleDateString()}`
                          : `Starts: ${new Date(election.ends_at).toLocaleDateString()}`}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      active
                        ? "bg-green-500/10 border border-green-500/20 text-green-400"
                        : ended
                        ? "bg-slate-500/10 border border-slate-500/20 text-slate-400"
                        : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                    }`}
                  >
                    {active ? "Active" : ended ? "Ended" : "Pending"}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <span className="text-xs text-green-400 flex items-center gap-1">
                    🌍 Public
                  </span>
                  {ended && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/results/${election.id}`);
                      }}
                      className="ml-auto rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-500"
                    >
                      View Results
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
