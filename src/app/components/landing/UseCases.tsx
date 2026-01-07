"use client";

import { motion } from "framer-motion";
import { Building2, GraduationCap, Users, Vote } from "lucide-react";
import { cn } from "@/lib/utils";

const useCases = [
    {
        title: "DAO Governance",
        description: "Decentralized decision making for DAOs with weighted voting and on-chain execution.",
        icon: Users,
        color: "text-blue-400",
        bg: "bg-blue-400/10",
    },
    {
        title: "Corporate Board",
        description: "Secure and transparent board resolutions with complete audit trails and privacy.",
        icon: Building2,
        color: "text-purple-400",
        bg: "bg-purple-400/10",
    },
    {
        title: "University Elections",
        description: "Student council and faculty elections with verified student identities.",
        icon: GraduationCap,
        color: "text-green-400",
        bg: "bg-green-400/10",
    },
    {
        title: "Public Polling",
        description: "Large scale public opinion polling with sybil resistance mechanisms.",
        icon: Vote,
        color: "text-orange-400",
        bg: "bg-orange-400/10",
    },
];

export function UseCases() {
    return (
        <section id="use-cases" className="py-24 relative overflow-hidden">
            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="text-center mb-16">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 mb-4"
                    >
                        Built for Every Scenario
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-slate-400 max-w-2xl mx-auto"
                    >
                        From small private organizations to large scale public elections, Vote Chain scales to meet your needs.
                    </motion.p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {useCases.map((item, index) => (
                        <motion.div
                            key={item.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="relative group p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                            <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-transform group-hover:scale-110", item.bg)}>
                                <item.icon className={cn("w-6 h-6", item.color)} />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                            <p className="text-slate-400 text-sm">{item.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
