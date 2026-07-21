import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Problem } from "@/components/Problem";
import { HowItWorks } from "@/components/HowItWorks";
import { WhatYouGet } from "@/components/WhatYouGet";
import { ForWhom } from "@/components/ForWhom";
import { About } from "@/components/About";
import { SocialProof } from "@/components/SocialProof";
import { ContactForm } from "@/components/ContactForm";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <WhatYouGet />
        <ForWhom />
        <About />
        <SocialProof />
        <ContactForm />
      </main>
      <Footer />
    </>
  );
}
