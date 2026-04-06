import { LandingNav } from '@/components/landing/LandingNav';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { HeroSection } from '@/components/landing/HeroSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { MonetizationSimulator } from '@/components/landing/MonetizationSimulator';
import { UrgencySection } from '@/components/landing/UrgencySection';
import { PricingSection } from '@/components/landing/PricingSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { FooterSection } from '@/components/landing/FooterSection';
import { SeoSchema } from '@/components/SeoSchema';

const Index = () => (
  <div className="min-h-screen bg-[#0A0A0A]">
    <SeoSchema />
    <ScrollProgress />
    <LandingNav />
    <HeroSection />
    <TestimonialsSection />
    <FeaturesSection />
    <MonetizationSimulator />
    <UrgencySection />
    <PricingSection />
    <FaqSection />
    <FooterSection />
  </div>
);

export default Index;
