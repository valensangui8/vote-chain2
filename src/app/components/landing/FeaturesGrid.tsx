"use client";

import { motion } from "framer-motion";
import { Lock, FileCheck, Fingerprint, Network, ShieldCheck, Cpu, Wallet, Globe } from "lucide-react";

export function FeaturesGrid() {
    return (
        <section id="tech" className="pt-24 pb-0 relative">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">

                <div className="text-center mb-20">
                    <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
                        Built with <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">Next-Gen Tech</span>
                    </h2>
                    <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                        VoteChain combines the world's best privacy and authentication technologies to create a voting system that is both easy to use and mathematically secure.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 lg:gap-12">

                    {/* Privy Card */}
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Wallet className="w-32 h-32 text-indigo-500 transform rotate-12 translate-x-10 -translate-y-10" />
                        </div>
                        <div className="relative z-10">
                            <div className="h-12 w-12 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-6">
                                <UserIcon className="h-6 w-6 text-indigo-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-3">Privy Authentication</h3>
                            <p className="text-slate-400 leading-relaxed mb-4">
                                Onboarding to Web3 shouldn't be hard. We use <strong>Privy</strong> to allow you to sign in securely using just your email or social accounts, while automatically creating a secure embedded wallet for you in the background.
                            </p>
                            <ul className="space-y-2">
                                <li className="flex items-center gap-2 text-sm text-slate-300">
                                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                    No seed phrases to memorize
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-300">
                                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                    Email Login
                                </li>
                            </ul>
                        </div>
                    </motion.div>

                    {/* ZK / Semaphore Card */}
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Fingerprint className="w-32 h-32 text-fuchsia-500 transform -rotate-12 translate-x-10 -translate-y-10" />
                        </div>
                        <div className="relative z-10">
                            <div className="h-12 w-12 rounded-xl bg-fuchsia-500/20 flex items-center justify-center mb-6">
                                <ShieldCheck className="h-6 w-6 text-fuchsia-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-3">Zero-Knowledge Proofs</h3>
                            <p className="text-slate-400 leading-relaxed mb-4">
                                How do you prove you have the right to vote without revealing <em>who</em> you are? We use the <strong>Semaphore Protocol</strong>. It generates a cryptographic "Zero-Knowledge Proof" that verifies your membership in the voter list without exposing your identity.
                            </p>
                            <ul className="space-y-2">
                                <li className="flex items-center gap-2 text-sm text-slate-300">
                                    <div className="h-1.5 w-1.5 rounded-full bg-fuchsia-500" />
                                    Total Anonymity
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-300">
                                    <div className="h-1.5 w-1.5 rounded-full bg-fuchsia-500" />
                                    Double-voting prevention
                                </li>
                            </ul>
                        </div>
                    </motion.div>

                    {/* Blockchain Card */}
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="md:col-span-2 p-8 rounded-3xl bg-gradient-to-br from-violet-900/20 to-black border border-white/10 backdrop-blur-sm relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Network className="w-64 h-64 text-violet-500 transform translate-x-20 -translate-y-20" />
                        </div>
                        <div className="grid md:grid-cols-2 gap-8 items-center relative z-10">
                            <div>
                                <div className="h-12 w-12 rounded-xl bg-violet-500/20 flex items-center justify-center mb-6">
                                    <Globe className="h-6 w-6 text-violet-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-3">Powered by Blockchain</h3>
                                <p className="text-slate-400 leading-relaxed">
                                    Your vote isn't stored in a private database where it can be deleted or changed. It is recorded directly on the <strong>Ethereum</strong> blockchain (Sepolia Network). This creates an immutable, public, and verifiable record of the election that will last forever.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                                    <FileCheck className="h-6 w-6 text-green-400 mb-2" />
                                    <h4 className="font-semibold text-white text-sm">Verifiable</h4>
                                    <p className="text-xs text-slate-500">Anyone can audit the results</p>
                                </div>
                                <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                                    <Lock className="h-6 w-6 text-amber-400 mb-2" />
                                    <h4 className="font-semibold text-white text-sm">Immutable</h4>
                                    <p className="text-xs text-slate-500">Cannot be altered</p>
                                </div>
                                <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                                    <Cpu className="h-6 w-6 text-blue-400 mb-2" />
                                    <h4 className="font-semibold text-white text-sm">Smart Contracts</h4>
                                    <p className="text-xs text-slate-500">Automated logic</p>
                                </div>
                                <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                                    <Network className="h-6 w-6 text-purple-400 mb-2" />
                                    <h4 className="font-semibold text-white text-sm">Decentralized</h4>
                                    <p className="text-xs text-slate-500">No central authority</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

function UserIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    )
}
