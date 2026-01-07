import Link from "next/link";
import { Hexagon, Twitter, Github, Disc } from "lucide-react";
import { Button } from "@/app/components/ui/Button";

export function Footer() {
    return (
        <footer className="border-t border-white/5 bg-[#050508] relative overflow-hidden">
            {/* Mesh Gradient Overlay */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full bg-violet-900/5 blur-[100px] pointer-events-none" />

            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 relative z-10">
                <div className="grid grid-cols-1 gap-12 lg:grid-cols-4">

                    {/* Brand Column */}
                    <div className="lg:col-span-1">
                        <Link href="/" className="flex items-center gap-2 mb-6">
                            <Hexagon className="h-8 w-8 text-violet-500 fill-violet-500/20" />
                            <span className="text-2xl font-bold text-white">VoteChain</span>
                        </Link>
                        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                            The world's most secure and transparent voting platform, powered by advanced zero-knowledge proofs and blockchain technology.
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="text-slate-500 hover:text-violet-400 transition-colors"><Twitter className="h-5 w-5" /></a>
                            <a href="#" className="text-slate-500 hover:text-violet-400 transition-colors"><Github className="h-5 w-5" /></a>
                            <a href="#" className="text-slate-500 hover:text-violet-400 transition-colors"><Disc className="h-5 w-5" /></a>
                        </div>
                    </div>

                    {/* Links Columns */}
                    <div>
                        <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">Product</h3>
                        <ul className="space-y-3">
                            <li><Link href="#" className="text-sm text-slate-400 hover:text-violet-400 transition-colors">Features</Link></li>
                            <li><Link href="#" className="text-sm text-slate-400 hover:text-violet-400 transition-colors">Integrations</Link></li>
                            <li>
                                <a href="#use-cases" className="text-sm leading-6 text-slate-400 hover:text-white transition-colors">
                                    Use Cases
                                </a>
                            </li>
                            <li>
                                <a href="#technology" className="text-sm leading-6 text-slate-400 hover:text-white transition-colors">
                                    Technology
                                </a>
                            </li>
                            <li><Link href="#" className="text-sm text-slate-400 hover:text-violet-400 transition-colors">Changelog</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">Resources</h3>
                        <ul className="space-y-3">
                            <li><Link href="#" className="text-sm text-slate-400 hover:text-violet-400 transition-colors">Documentation</Link></li>
                            <li><Link href="#" className="text-sm text-slate-400 hover:text-violet-400 transition-colors">API Reference</Link></li>
                            <li><Link href="#" className="text-sm text-slate-400 hover:text-violet-400 transition-colors">Community</Link></li>
                            <li><Link href="#" className="text-sm text-slate-400 hover:text-violet-400 transition-colors">Help Center</Link></li>
                        </ul>
                    </div>

                    {/* Newsletter Column */}
                    <div>
                        <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">Stay updated</h3>
                        <p className="text-sm text-slate-400 mb-4">
                            Subscribe to our newsletter for the latest updates and security reports.
                        </p>
                        <form className="flex gap-2">
                            <input
                                type="email"
                                placeholder="Enter your email"
                                className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 w-full"
                            />
                            <Button type="submit" size="sm" variant="secondary">Subscribe</Button>
                        </form>
                    </div>
                </div>

                <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-slate-500">
                        &copy; 2026 VoteChain Inc. All rights reserved.
                    </p>
                    <div className="flex gap-6">
                        <Link href="#" className="text-xs text-slate-500 hover:text-slate-300">Privacy Policy</Link>
                        <Link href="#" className="text-xs text-slate-500 hover:text-slate-300">Terms of Service</Link>
                        <Link href="#" className="text-xs text-slate-500 hover:text-slate-300">Cookie Policy</Link>
                    </div>
                </div>

                {/* Decorator Line */}
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
            </div>
        </footer>
    );
}
