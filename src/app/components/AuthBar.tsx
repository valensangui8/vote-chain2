"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";

export function AuthBar() {
  const { authenticated, user, login, logout, ready } = usePrivy();
  const router = useRouter();

  const handleLogin = async () => {
    await login();
    router.push("/dashboard");
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-end text-xs text-slate-500">
        Connecting wallet...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleLogin}
          className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          Sign in with Privy
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-3 text-xs text-slate-700">
      <span className="max-w-[140px] truncate rounded-full bg-slate-100 px-3 py-1 font-mono">
        {user?.wallet?.address ?? user?.id}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-full border border-slate-300 px-3 py-1 font-semibold hover:border-slate-400"
      >
        Logout
      </button>
    </div>
  );
}


