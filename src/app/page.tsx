"use client";

import { useEffect } from "react";
import { HeroSection } from "./components/landing/HeroSection";
import { CompaniesMarquee } from "./components/landing/CompaniesMarquee";
import { HowItWorks } from "./components/landing/HowItWorks";
import { FeaturesGrid } from "./components/landing/FeaturesGrid";
import { UseCases } from "./components/landing/UseCases";
import { TechDetails } from "./components/landing/TechDetails";
import { Footer } from "./components/Footer";

export default function Home() {
  // Handle hash navigation - scroll to section when hash is in URL
  useEffect(() => {
    const handleHashScroll = () => {
      if (window.location.hash) {
        const hash = window.location.hash.substring(1); // Remove the #
        const element = document.getElementById(hash);
        if (element) {
          // Small delay to ensure DOM is ready
          setTimeout(() => {
            element.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }
      }
    };

    // Run on mount and when hash changes
    handleHashScroll();
    window.addEventListener("hashchange", handleHashScroll);
    return () => window.removeEventListener("hashchange", handleHashScroll);
  }, []);

  // If redirecting, we can show null or a loading spinner, or just the landing page 
  // briefly before redirect. Showing landing page is safer to avoid flicker of empty screen 
  // if redirect is slow, although a spinner is often preferred. 
  // Given we are client-side rendering, let's just show the landing page content
  // and the redirect will happen immediately on mount if auth'd.

  return (
    <div className="min-h-screen">
      <HeroSection />
      <CompaniesMarquee />
      <HowItWorks />
      <FeaturesGrid />
      <TechDetails />
      <UseCases />
      <Footer />
    </div>
  );
}
