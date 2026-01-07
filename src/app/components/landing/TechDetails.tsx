"use client";

import { motion } from "framer-motion";
import { Shield, Lock, Database, ArrowRight } from "lucide-react";

const steps = [
    {
        title: "Connect & Verify",
        description: "Users authenticate via Privy using email login or Web3 wallets. Identity is verified without exposing personal data.",
        icon: Shield,
    },
    {
        title: "Generate Proof",
        description: "A Zero-Knowledge Proof (ZKP) is generated locally on the user's device, proving eligibility to vote without revealing identity.",
        icon: Lock,
    },
    {
        title: "Cast Vote",
        description: "The vote and proof are submitted to the blockchain. The smart contract verifies the proof and records the vote immutably.",
        icon: Database,
    },
];

export function TechDetails() {
    return (
        <section id="technology" className="pt-12 pb-24 relative">
            {/* Background decorative elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px]" />
            </div>

            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="text-center mt-16 mb-20">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-3xl md:text-5xl font-bold text-white mb-6"
                    >
                        How It Works Under the Hood
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-lg text-slate-300 max-w-3xl mx-auto"
                    >
                        Leveraging <span className="text-violet-400 font-semibold">Privy</span> for seamless onboarding, <span className="text-cyan-400 font-semibold">Zero-Knowledge Proofs</span> for absolute privacy, and <span className="text-emerald-400 font-semibold">Blockchain</span> for unalterable records.
                    </motion.p>
                </div>

                <div className="relative">
                    {/* Connecting Line for desktop */}
                    <div className="hidden md:block absolute top-[2.5rem] left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

                    <div className="grid md:grid-cols-3 gap-12 relative z-10">
                        {steps.map((step, index) => (
                            <motion.div
                                key={step.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.2 }}
                                className="flex flex-col items-center text-center"
                            >
                                <div className="w-20 h-20 rounded-2xl bg-[#0F172A] border border-white/10 flex items-center justify-center mb-8 relative shadow-xl shadow-violet-500/5 group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <step.icon className="w-10 h-10 text-violet-400" />

                                    {/* Number badge */}
                                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-sm border-2 border-[#0B1121]">
                                        {index + 1}
                                    </div>
                                </div>

                                <h3 className="text-2xl font-bold text-white mb-4">{step.title}</h3>
                                <p className="text-slate-400 leading-relaxed">{step.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
