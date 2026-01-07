"use client";

import { motion } from "framer-motion";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { CheckCircle2, Shield, Zap, Lock, ChevronRight, MousePointer2 } from "lucide-react";

export function HeroSection() {
    return (
        <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid lg:grid-cols-2 gap-16 items-center">

                    {/* Left Column: Text Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-sm text-slate-300 font-medium">The voting system of the future</span>
                        </div>

                        <h1 className="text-6xl lg:text-8xl font-black tracking-tighter leading-[0.9] text-white mb-6">
                            VOTE <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-indigo-500">
                                CHAIN
                            </span>
                        </h1>

                        <p className="text-xl text-slate-400 mb-8 max-w-lg leading-relaxed">
                            Secure, transparent, and immutable voting powered by blockchain technology.
                            <span className="text-white font-medium"> Every vote counts, every vote is verifiable, no vote can be altered.</span>
                        </p>

                        <div className="flex flex-wrap gap-6 mb-12">
                            <div className="flex items-center gap-2 text-slate-300">
                                <Shield className="h-5 w-5 text-violet-500" />
                                <span>Secure</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                                <Lock className="h-5 w-5 text-violet-500" />
                                <span>Private</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                                <Zap className="h-5 w-5 text-violet-500" />
                                <span>Instant</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <Button size="lg" variant="gradient" className="text-lg px-8 h-14 rounded-full shadow-lg shadow-violet-500/25">
                                Get started <ChevronRight className="ml-2 h-5 w-5" />
                            </Button>
                            <Button size="lg" variant="outline" className="text-lg px-8 h-14 rounded-full">
                                Watch demo
                            </Button>
                        </div>
                    </motion.div>

                    {/* Right Column: 3D Visualization */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, delay: 0.2 }}
                        className="relative hidden lg:block"
                    >
                        {/* Main Floating Card */}
                        <motion.div
                            animate={{ y: [0, -20, 0] }}
                            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                            className="relative z-20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl"
                        >
                            {/* Fake UI Elements */}
                            <div className="space-y-6">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center justify-between bg-black/20 p-4 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400">
                                                <CheckCircle2 className="h-5 w-5" />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="h-2 w-32 bg-white/10 rounded-full" />
                                                <div className="h-2 w-20 bg-white/5 rounded-full" />
                                            </div>
                                        </div>
                                        <div className="h-2 w-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                    </div>
                                ))}
                            </div>

                            {/* Hash Animation */}
                            <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
                                <div className="font-mono text-xs text-violet-400 bg-violet-500/10 px-3 py-1 rounded-md">
                                    0x7f3a...9c2d
                                </div>
                                <div className="flex gap-1">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                                    ))}
                                </div>
                            </div>
                        </motion.div>

                        {/* Decorative Orbiting Elements (Simplified) */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] z-0">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full border border-violet-500/10 animate-[spin_20s_linear_infinite]" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full border border-indigo-500/10 animate-[spin_15s_linear_infinite_reverse]" />
                        </div>

                        {/* Scanning Line Effect */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/5 to-transparent h-[2px] w-full animate-[scan_3s_ease-in-out_infinite] pointer-events-none z-30" />

                        <style jsx>{`
              @keyframes scan {
                0% { top: 0%; opacity: 0; }
                50% { opacity: 1; }
                100% { top: 100%; opacity: 0; }
              }
            `}</style>
                    </motion.div>

                </div>

            </div>
        </section>
    );
}
