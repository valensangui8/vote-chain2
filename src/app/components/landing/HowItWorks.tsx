"use client";

import { motion } from "framer-motion";
import { UserPlus, Vote, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";

const steps = [
    {
        icon: UserPlus,
        title: "Sign up",
        description: "Connect your wallet and create your anonymous identity in seconds.",
        color: "from-violet-600 to-indigo-600",
    },
    {
        icon: Vote,
        title: "Vote",
        description: "Cast your vote on active elections. Your choice is encrypted instantly.",
        color: "from-fuchsia-600 to-pink-600",
    },
    {
        icon: ShieldCheck,
        title: "Blockchain Record",
        description: "Your vote is recorded on-chain using zero-knowledge proofs.",
        color: "from-blue-600 to-cyan-600",
    },
    {
        icon: CheckCircle2,
        title: "Verify",
        description: "Verify your vote was counted correctly without revealing your choice.",
        color: "from-emerald-600 to-green-600",
    },
];

export function HowItWorks() {
    return (
        <section id="how-it-works" className="py-24 relative overflow-hidden">
            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="text-center mb-16">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl lg:text-5xl font-bold text-white mb-4"
                    >
                        Simple <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">Process</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-slate-400 text-lg max-w-2xl mx-auto"
                    >
                        Our technology handles the complexity so you can focus on making your voice heard.
                    </motion.p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {steps.map((step, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="relative"
                        >
                            {/* Connector Line (Desktop only, except last item) */}
                            {index < steps.length - 1 && (
                                <div className="hidden lg:block absolute top-12 left-1/2 w-full h-[2px] bg-gradient-to-r from-white/10 to-transparent z-0">
                                    <div className="absolute right-0 -top-1.5 text-white/10">
                                        <ArrowRight className="h-4 w-4" />
                                    </div>
                                </div>
                            )}

                            <div className="relative z-10 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors h-full group">
                                {/* Background Number */}
                                <span className="absolute top-4 right-4 text-6xl font-black text-white/5 group-hover:text-white/10 transition-colors select-none">
                                    0{index + 1}
                                </span>

                                {/* Icon */}
                                <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${step.color} p-0.5 mb-6`}>
                                    <div className="h-full w-full bg-black/50 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                        <step.icon className="h-7 w-7 text-white" />
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{step.description}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
