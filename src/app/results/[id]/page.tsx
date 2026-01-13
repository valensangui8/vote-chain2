"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

type ElectionResult = {
  id: string;
  name: string;
  image: string;
  voteCount: number;
  percentage: number;
};

type Winner = {
  id: string;
  name: string;
};

type ElectionInfo = {
  id: string;
  name: string;
  isPublic: boolean;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  onchainElectionId: string;
};

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, authenticated, login, ready } = usePrivy();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [election, setElection] = useState<ElectionInfo | null>(null);
  const [results, setResults] = useState<ElectionResult[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [hasWinner, setHasWinner] = useState(false);
  const [isTie, setIsTie] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [requiresAuth, setRequiresAuth] = useState(false);

  useEffect(() => {
    // CRITICAL: Wait for Privy to be ready before fetching
    // This prevents the race condition where we fetch without userId
    if (!ready) {
      console.log("⏳ Waiting for Privy to be ready...");
      return;
    }

    if (params?.id) {
      console.log("🚀 Privy ready, fetching results", { authenticated, hasUser: !!user?.id });
      fetchResults();
    }
  }, [params?.id, ready, user?.id]); // Only depend on ready and user.id, not authenticated

  async function fetchResults() {
    if (!params?.id) {
      setError("Election ID not found");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build URL with optional userId parameter
      // Always include userId if user is authenticated
      let url = `/api/elections/${params.id}/results`;
      if (user?.id) {
        url += `?userId=${encodeURIComponent(user.id)}`;
      }

      console.log("🔍 Fetching results:", { url, hasUser: !!user?.id, authenticated });

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        // Handle specific error cases
        if (res.status === 403) {
          setIsPrivate(data.isPrivate || false);
          setRequiresAuth(data.requiresAuth || false);
          setError(data.error || "You are not authorized to view these results");
        } else {
          setError(data.error || "Failed to load results");
        }
        return;
      }

      setElection(data.election);
      setResults(data.results);
      setTotalVotes(data.totalVotes);
      setWinners(data.winners);
      setHasWinner(data.hasWinner);
      setIsTie(data.isTie);
    } catch (err: any) {
      console.error("Error fetching results:", err);
      setError("Failed to load election results");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10 mt-20">
        <div className="glass rounded-2xl border border-white/10 p-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-700/50 rounded w-1/2 mx-auto"></div>
            <div className="h-4 bg-slate-700/50 rounded w-1/3 mx-auto"></div>
            <div className="mt-6 space-y-3">
              <div className="h-16 bg-slate-700/30 rounded-lg"></div>
              <div className="h-16 bg-slate-700/30 rounded-lg"></div>
            </div>
          </div>
          <p className="text-slate-400 mt-4">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10 mt-20">
        <div className="glass rounded-2xl border-2 border-red-500/50 bg-red-500/10 p-8 text-center">
          <div className="mx-auto h-16 w-16 text-red-500 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-3">
            {isPrivate ? "Private Election" : "Access Denied"}
          </h2>
          <p className="text-red-300 mb-6">{error}</p>

          {requiresAuth && !authenticated && (
            <button
              onClick={() => login()}
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-500 hover:scale-105 shadow-lg shadow-indigo-500/20"
            >
              Sign In to View Results
            </button>
          )}

          {isPrivate && authenticated && (
            <div className="space-y-3">
              <p className="text-sm text-red-300">
                Only participants who voted in this election can view the results.
              </p>
              <button
                onClick={() => router.push("/voter")}
                className="rounded-lg bg-slate-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-500 hover:scale-105"
              >
                View Your Invitations
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10 mt-20">
        <div className="glass rounded-2xl border border-white/10 p-12 text-center">
          <div className="mx-auto h-16 w-16 text-slate-600 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-slate-300 font-medium mb-1">Election not found</p>
          <p className="text-sm text-slate-400">The election you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const maxVotes = Math.max(...results.map((r) => r.voteCount), 0);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10 mt-20">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">
              Election Results
            </p>
            <h1 className="text-3xl font-bold text-white mt-2">{election.name}</h1>
            {election.endsAt && (
              <p className="text-sm text-slate-400 mt-2">
                Ended: {new Date(election.endsAt).toLocaleString()}
              </p>
            )}
          </div>
          <span
            className={`rounded-full px-4 py-2 text-xs font-semibold border ${
              election.isPublic
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-purple-500/10 border-purple-500/30 text-purple-400"
            }`}
          >
            {election.isPublic ? "🌍 Public Election" : "🔒 Private Election"}
          </span>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4 border border-white/10">
          <p className="text-xs text-slate-400 mb-1">Total Votes</p>
          <p className="text-2xl font-bold text-white">{totalVotes}</p>
        </div>
        <div className="glass rounded-xl p-4 border border-white/10">
          <p className="text-xs text-slate-400 mb-1">Candidates</p>
          <p className="text-2xl font-bold text-white">{results.length}</p>
        </div>
        <div className="glass rounded-xl p-4 border border-white/10">
          <p className="text-xs text-slate-400 mb-1">Turnout</p>
          <p className="text-2xl font-bold text-white">
            {totalVotes > 0 ? "Active" : "No votes"}
          </p>
        </div>
      </div>

      {/* Winner Announcement */}
      {totalVotes > 0 && (
        <div
          className={`glass rounded-2xl border-2 p-6 ${
            hasWinner
              ? "border-green-500/50 bg-green-500/10"
              : isTie
                ? "border-yellow-500/50 bg-yellow-500/10"
                : "border-slate-500/50 bg-slate-500/10"
          }`}
        >
          {hasWinner && (
            <div className="flex items-center gap-4">
              <div className="text-4xl">🏆</div>
              <div className="flex-1">
                <p className="text-sm font-semibold uppercase tracking-wide text-green-400 mb-1">
                  Winner
                </p>
                <h2 className="text-2xl font-bold text-white">{winners[0].name}</h2>
                <p className="text-sm text-green-300 mt-1">
                  {results.find((r) => r.id === winners[0].id)?.voteCount} votes (
                  {results.find((r) => r.id === winners[0].id)?.percentage.toFixed(1)}%)
                </p>
              </div>
            </div>
          )}
          {isTie && (
            <div className="flex items-center gap-4">
              <div className="text-4xl">🤝</div>
              <div className="flex-1">
                <p className="text-sm font-semibold uppercase tracking-wide text-yellow-400 mb-1">
                  Tie Result
                </p>
                <p className="text-2xl font-bold text-white">
                  {winners.map((w) => w.name).join(" & ")}
                </p>
                <p className="text-sm text-yellow-300 mt-1">
                  {results.find((r) => r.id === winners[0].id)?.voteCount} votes each
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      <div className="glass rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">All Results</h3>
          <p className="text-sm text-slate-400">Sorted by votes</p>
        </div>

        {totalVotes === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto h-16 w-16 text-slate-600 mb-4">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-slate-400 font-medium">No votes cast yet</p>
            <p className="text-xs text-slate-500 mt-2">Results will appear here once voting begins</p>
          </div>
        ) : (
          <div className="space-y-4">
            {results
              .sort((a, b) => b.voteCount - a.voteCount)
              .map((candidate, index) => (
                <div key={candidate.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span className={`text-sm font-bold w-6 ${
                        index === 0 && candidate.voteCount === maxVotes
                          ? "text-green-400"
                          : "text-slate-500"
                      }`}>
                        #{index + 1}
                      </span>
                      {candidate.image ? (
                        <img
                          src={candidate.image}
                          alt={candidate.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-white/20"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-semibold">
                          {candidate.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-base font-semibold text-white">
                        {candidate.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-white">
                        {candidate.voteCount} {candidate.voteCount === 1 ? "vote" : "votes"}
                      </p>
                      <p className="text-sm text-slate-400">
                        {candidate.percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-700 ${
                        candidate.voteCount === maxVotes && maxVotes > 0
                          ? "bg-gradient-to-r from-green-500 to-green-400"
                          : "bg-gradient-to-r from-indigo-500 to-indigo-400"
                      }`}
                      style={{ width: `${candidate.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Back Button */}
      <div className="flex justify-center">
        <button
          onClick={() => router.back()}
          className="rounded-lg border border-white/20 bg-white/5 px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:border-white/30"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
