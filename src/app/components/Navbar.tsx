"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Hexagon, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/Button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const { authenticated, user, login, logout, ready } = usePrivy();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleLogin = async () => {
    await login();
    // Navigation will be handled by the useEffect above
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const navLinks = authenticated
    ? [
      { name: "Voter", href: "/voter" },
      { name: "Organizer", href: "/organizer" },
      { name: "Public elections", href: "/public-elections" },
    ]
    : [
      { name: "How it works", href: "/#how-it-works" },
      { name: "Tech", href: "/#tech" },
      { name: "Use Cases", href: "/#use-cases" },
      { name: "Public elections", href: "/public-elections" },
    ];

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-transparent",
        isScrolled && "bg-black/60 backdrop-blur-xl border-white/5 shadow-lg"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative flex h-10 w-10 items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-lg opacity-80 blur-lg group-hover:opacity-100 transition duration-500" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-black/50 border border-white/10 backdrop-blur-sm">
                <Hexagon className="h-6 w-6 text-violet-400 fill-violet-400/20" />
              </div>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              VoteChain
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors relative group"
                onClick={(e) => {
                  if (link.href.startsWith("/#")) {
                    // Only prevent default and scroll if we're already on the home page
                    if (pathname === "/") {
                      e.preventDefault();
                      scrollToSection(link.href.substring(2));
                    }
                    // Otherwise, let the Link navigate normally to /#section
                  }
                }}
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-violet-500 transition-all group-hover:w-full" />
              </Link>
            ))}
          </div>

          {/* Auth Section */}
          <div className="hidden md:flex items-center gap-4">
            {!ready ? (
              <span className="text-xs text-slate-500 animate-pulse">Initializing...</span>
            ) : !authenticated ? (
              <Button onClick={handleLogin} variant="gradient" className="rounded-full">
                Login
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-slate-400">Connected as</span>
                  <span className="text-xs font-mono text-violet-400">
                    {user?.wallet?.address ?
                      `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}` :
                      "User"}
                  </span>
                </div>
                <Button onClick={handleLogout} variant="outline" size="sm" className="rounded-full">
                  Logout
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-slate-300 hover:text-white p-2"
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-black/90 backdrop-blur-xl border-b border-white/10 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="block text-base font-medium text-slate-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-md"
                  onClick={(e) => {
                    setIsMobileMenuOpen(false);
                    // Handle hash links in mobile menu
                    if (link.href.startsWith("/#") && pathname === "/") {
                      e.preventDefault();
                      scrollToSection(link.href.substring(2));
                    }
                  }}
                >
                  {link.name}
                </Link>
              ))}
              <div className="pt-4 border-t border-white/10">
                {!authenticated ? (
                  <Button onClick={handleLogin} variant="gradient" className="w-full">
                    Login
                  </Button>
                ) : (
                  <Button onClick={handleLogout} variant="outline" className="w-full">
                    Logout
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
