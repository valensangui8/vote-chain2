"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";

export function Navbar() {
  const { authenticated, user, login, logout, ready } = usePrivy();

  return (
    <nav className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
              <span className="text-xl font-bold text-white">V</span>
            </div>
            <span className="text-xl font-bold text-slate-900">VoteChain</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/organizer"
              className="text-sm font-medium text-slate-700 hover:text-indigo-600 transition"
            >
              Organizer
            </Link>
            <Link
              href="/voter"
              className="text-sm font-medium text-slate-700 hover:text-indigo-600 transition"
            >
              Voter
            </Link>
            <Link
              href="/admin"
              className="text-sm font-medium text-slate-700 hover:text-indigo-600 transition"
            >
              Admin
            </Link>
          </div>

          {/* Auth Section */}
          <div className="flex items-center gap-3">
            {!ready ? (
              <span className="text-xs text-slate-500">Connecting...</span>
            ) : !authenticated ? (
              <button
                type="button"
                onClick={() => login()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
              >
                Sign in
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="max-w-[140px] truncate rounded-full bg-slate-100 px-3 py-1.5 text-xs font-mono text-slate-700">
                  {user?.wallet?.address ?? user?.id}
                </span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

