"use client";

import { motion } from "framer-motion";

const companies = [
    "TechCorp", "GlobalVote", "SecureElect", "DemocraTech",
    "ChainGov", "VoteSafe", "ElectroBlock", "CryptoVote"
];

const stats = [
    { value: "500+", label: "Companies" },
    { value: "10M+", label: "Votes processed" },
    { value: "99.99%", label: "Uptime" },
    { value: "50+", label: "Countries" },
];

export function CompaniesMarquee() {
    return (
        <section className="py-20 border-y border-white/5 bg-black/40 backdrop-blur-sm overflow-hidden">
            <div className="mb-10 text-center">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Trusted by Global Leaders</p>
            </div>

            {/* Marquee */}
            <div className="relative flex w-full overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-r from-[#0a0a0f] to-transparent pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-l from-[#0a0a0f] to-transparent pointer-events-none" />

                <motion.div
                    animate={{ x: ["0%", "-50%"] }}
                    transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
                    className="flex gap-16 whitespace-nowrap px-8"
                >
                    {[...companies, ...companies, ...companies].map((company, i) => (
                        <div key={i} className="text-2xl font-bold text-slate-700 hover:text-white transition-colors cursor-default">
                            {company}
                        </div>
                    ))}
                </motion.div>
            </div>

            {/* Stats */}
            <div className="mt-20 mx-auto max-w-7xl px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    {stats.map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                        >
                            <div className="text-4xl md:text-5xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                                {stat.value}
                            </div>
                            <div className="text-sm text-slate-500 font-medium">
                                {stat.label}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
