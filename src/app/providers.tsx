"use client";

import { PrivyAuthProvider } from "@/lib/privy";
import { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return <PrivyAuthProvider>{children}</PrivyAuthProvider>;
}


