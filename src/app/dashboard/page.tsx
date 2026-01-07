"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { Card, CardContent } from "../components/ui/Card";
import { ChevronRight, Vote, Users, ShieldAlert, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const { authenticated, ready, user } = usePrivy();
    const router = useRouter();

    useEffect(() => {
        if (ready && !authenticated) {
            router.push("/");
        }
    }, [ready, authenticated, router]);

    if (!ready || !authenticated) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen pt-32 pb-12">
            <main className="mx-auto max-w-6xl px-6">
                <header className="mb-12 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 mb-4">
                        <span className="text-xs font-mono text-violet-400">DASHBOARD</span>
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-3">
                        Welcome back
                    </h1>
                    <p className="text-slate-400 text-lg">
                        Select how you&apos;d like to participate in anonymous voting
                    </p>
                </header>

                <div className="grid gap-8 md:grid-cols-3">
                    {/* Voter Card */}
                    <Link href="/voter" className="group">
                        <Card className="h-full border-white/10 bg-white/5 hover:bg-white/10 hover:border-violet-500/50 transition-all duration-300">
                            <CardContent className="p-8 flex flex-col h-full items-center text-center">
                                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <Vote className="h-10 w-10 text-indigo-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-3">Vote</h3>
                                <p className="text-slate-400 mb-8 flex-grow">
                                    View your election invitations and cast anonymous votes using zero-knowledge proofs.
                                </p>
                                <div className="flex items-center text-indigo-400 font-semibold group-hover:text-indigo-300">
                                    Enter Portal <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* Organizer Card */}
                    <Link href="/organizer" className="group">
                        <Card className="h-full border-white/10 bg-white/5 hover:bg-white/10 hover:border-fuchsia-500/50 transition-all duration-300">
                            <CardContent className="p-8 flex flex-col h-full items-center text-center">
                                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <Users className="h-10 w-10 text-fuchsia-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-3">Organize</h3>
                                <p className="text-slate-400 mb-8 flex-grow">
                                    Create elections, add candidates, invite voters, and manage your voting events.
                                </p>
                                <div className="flex items-center text-fuchsia-400 font-semibold group-hover:text-fuchsia-300">
                                    Manage Elections <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* Admin Card */}
                    <Link href="/admin" className="group">
                        <Card className="h-full border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-slate-500/50 transition-all duration-300 opacity-80 hover:opacity-100">
                            <CardContent className="p-8 flex flex-col h-full items-center text-center">
                                <div className="h-20 w-20 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <ShieldAlert className="h-10 w-10 text-slate-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-3">Admin</h3>
                                <p className="text-slate-400 mb-8 flex-grow">
                                    System administration and user management. Monitor platform health.
                                </p>
                                <div className="flex items-center text-slate-400 font-semibold group-hover:text-slate-300">
                                    Admin Panel <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            </main>
        </div>
    );
}
