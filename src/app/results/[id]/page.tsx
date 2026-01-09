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
  const { user, authenticated, login } = usePrivy();
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
    if (params?.id) {
      fetchResults();
    }
  }, [params?.id, user?.id]);

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
      let url = `/api/elections/${params.id}/results`;
      if (user?.id) {
        url += `?userId=${encodeURIComponent(user.id)}`;
      }

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
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/2 mx-auto"></div>
            <div className="h-4 bg-slate-200 rounded w-1/3 mx-auto"></div>
          </div>
          <p className="text-slate-600 mt-4">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-red-900 mb-3">
            {isPrivate ? "Private Election" : "Access Denied"}
          </h2>
          <p className="text-red-700 mb-6">{error}</p>
          
          {requiresAuth && !authenticated && (
            <button
              onClick={() => login()}
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Sign In to View Results
            </button>
          )}
          
          {isPrivate && authenticated && (
            <div className="space-y-3">
              <p className="text-sm text-red-600">
                Only participants who voted in this election can view the results.
              </p>
              <button
                onClick={() => router.push("/voter")}
                className="rounded-lg bg-slate-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-500"
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
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-600">Election not found</p>
        </div>
      </div>
    );
  }

  const maxVotes = Math.max(...results.map((r) => r.voteCount), 0);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-10">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-500">
              Election Results
            </p>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">{election.name}</h1>
          </div>
          <span
            className={`rounded-full px-4 py-1.5 text-xs font-medium ${
              election.isPublic
                ? "bg-green-100 text-green-800"
                : "bg-purple-100 text-purple-800"
            }`}
          >
            {election.isPublic ? "Public Election" : "Private Election"}
          </span>
        </div>
        
        {election.endsAt && (
          <p className="text-sm text-slate-600">
            Ended: {new Date(election.endsAt).toLocaleString()}
          </p>
        )}
      </header>

      {/* Winner Announcement */}
      {totalVotes > 0 && (
        <div
          className={`rounded-2xl border-2 p-6 ${
            hasWinner
              ? "border-green-300 bg-green-50"
              : isTie
              ? "border-yellow-300 bg-yellow-50"
              : "border-slate-300 bg-slate-50"
          }`}
        >
          {hasWinner && (
            <>
              <p className="text-sm font-semibold uppercase tracking-wide text-green-700 mb-2">
                🏆 Winner
              </p>
              <h2 className="text-2xl font-bold text-green-900">{winners[0].name}</h2>
              <p className="text-sm text-green-700 mt-1">
                {results.find((r) => r.id === winners[0].id)?.voteCount} votes (
                {results.find((r) => r.id === winners[0].id)?.percentage.toFixed(1)}%)
              </p>
            </>
          )}
          {isTie && (
            <>
              <p className="text-sm font-semibold uppercase tracking-wide text-yellow-700 mb-2">
                🤝 Tie Result
              </p>
              <p className="text-lg font-semibold text-yellow-900">
                {winners.map((w) => w.name).join(" & ")}
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                {results.find((r) => r.id === winners[0].id)?.voteCount} votes each
              </p>
            </>
          )}
        </div>
      )}

      {/* Results */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">All Results</h3>
          <p className="text-sm text-slate-600">Total votes: {totalVotes}</p>
        </div>

        {totalVotes === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600">No votes cast yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {results
              .sort((a, b) => b.voteCount - a.voteCount)
              .map((candidate, index) => (
                <div key={candidate.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-500">
                        #{index + 1}
                      </span>
                      {candidate.image && (
                        <img
                          src={candidate.image}
                          alt={candidate.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      )}
                      <span className="text-base font-semibold text-slate-900">
                        {candidate.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-slate-900">
                        {candidate.voteCount} votes
                      </p>
                      <p className="text-sm text-slate-600">
                        {candidate.percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        candidate.voteCount === maxVotes && maxVotes > 0
                          ? "bg-gradient-to-r from-green-500 to-green-600"
                          : "bg-gradient-to-r from-indigo-500 to-indigo-600"
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
          className="rounded-lg border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
