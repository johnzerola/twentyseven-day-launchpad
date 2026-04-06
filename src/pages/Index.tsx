import { HeroSection } from '@/components/landing/HeroSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { BeforeAfterSection } from '@/components/landing/BeforeAfterSection';
import { MonetizationSimulator } from '@/components/landing/MonetizationSimulator';
import { PricingSection } from '@/components/landing/PricingSection';
import { GuaranteeSection } from '@/components/landing/GuaranteeSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { FooterSection } from '@/components/landing/FooterSection';
import { LandingNav } from '@/components/landing/LandingNav';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <HeroSection />
      <TestimonialsSection />
      <FeaturesSection />
      <BeforeAfterSection />
      <MonetizationSimulator />
      <PricingSection />
      <GuaranteeSection />
      <FaqSection />
      <FooterSection />
    </div>
  );
};

export default Index;
