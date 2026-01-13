import Link from "next/link";
import { Hexagon } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t border-white/5 bg-[#050508]">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <Hexagon className="h-6 w-6 text-violet-500 fill-violet-500/20" />
                        <span className="text-lg font-semibold text-white">VoteChain</span>
                    </Link>
                    <p className="text-xs text-slate-500">
                        &copy; 2026 AdeA. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
