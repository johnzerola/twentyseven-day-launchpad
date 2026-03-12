import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { MonetizationSimulator } from '@/components/landing/MonetizationSimulator';
import { PricingSection } from '@/components/landing/PricingSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { FooterSection } from '@/components/landing/FooterSection';
import { LandingNav } from '@/components/landing/LandingNav';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <HeroSection />
      <FeaturesSection />
      <MonetizationSimulator />
      <PricingSection />
      <FaqSection />
      <FooterSection />
    </div>
  );
};

export default Index;
