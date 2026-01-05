"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function PrivyAuthProvider({ children }: Props) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  return (
    <PrivyProvider
      appId={appId || ""}
      config={{
        appearance: {
          theme: "light",
          accentColor: "#4f46e5",
          logo: "https://privy.io/favicon.ico",
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
      }}
    >
      <SmartWalletsProvider>{children}</SmartWalletsProvider>
    </PrivyProvider>
  );
}


