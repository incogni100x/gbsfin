import { Link } from "react-router";
import FeaturesGrid from "@/components/marketing/FeaturesGrid.jsx";
import MarketingFaq from "@/components/marketing/MarketingFaq.jsx";
import MarketingTestimonial from "@/components/marketing/MarketingTestimonial.jsx";
import HeroStats from "@/components/marketing/HeroStats.jsx";
import LogoLoop from "@/components/ui/LogoLoop.jsx";

const partnerLogos = [
  { alt: "Partner brand 1", src: "/hero1.svg" },
  { alt: "Partner brand 2", src: "/hero2.svg" },
  { alt: "Partner brand 3", src: "/hero3.svg" },
  { alt: "Partner brand 4", src: "/hero4.svg" },
  { alt: "Partner brand 5", src: "/hero5.svg" },
  { alt: "Partner brand 6", src: "/hero6.svg" },
];

function HomePage() {
  return (
    <section
      className="min-h-[calc(100svh-8rem)] bg-white pt-10 sm:pt-14 lg:pt-16"
    >
      <div className="mx-auto w-full max-w-[1000px] px-4 text-center sm:px-6">
        <h1 className="text-display-4-medium mx-auto max-w-9xl text-left text-balance md:text-center md:text-display-3-medium">
          Global money transfers made simple, wherever you go.
        </h1>
        <p className="text-headline-regular mx-auto mt-4 max-w-2xl text-left text-[var(--color-text-secondary)] text-pretty md:text-center">
          Send, receive, and convert global currencies from one secure account.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            className="text-body-medium inline-flex h-9 items-center justify-center rounded-2lg bg-button-primary px-3 text-text-white no-underline shadow-xs transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-[var(--color-accent-700)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus-ring motion-reduce:transition-none"
            to="/register"
          >
            Open an account
          </Link>
          <Link
            className="text-body-medium inline-flex h-9 items-center justify-center rounded-2lg border border-border-button-default bg-background-primary-default px-3 text-text-primary no-underline shadow-xs transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out hover:border-border-button-hover hover:bg-background-primary-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus-ring motion-reduce:transition-none"
            to="/contact"
          >
            Contact us
          </Link>
        </div>
        <div className="mx-auto mt-8 flex w-full justify-center sm:mt-8 lg:mt-6">
          <img
            alt="Global Stripe Fin account dashboard shown on a device"
            className="block h-auto w-full max-w-[320px] object-contain md:max-w-[1100px]"
            fetchPriority="high"
            src="/hero.webp"
          />
        </div>
        <section className="mt-10 border-t border-[var(--color-separator-border)] pt-6 sm:mt-12 sm:pt-8">
          <h2 className="sr-only">Trusted brands</h2>
          <LogoLoop logos={partnerLogos} />
        </section>
      </div>
      <FeaturesGrid />
      <HeroStats />
      <MarketingFaq />
      <MarketingTestimonial />
    </section>
  );
}

export default HomePage;
