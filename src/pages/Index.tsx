import { LandingNav } from '@/components/landing/LandingNav';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { HeroSection } from '@/components/landing/HeroSection';
import { TrustBar } from '@/components/landing/TrustBar';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { MonetizationSimulator } from '@/components/landing/MonetizationSimulator';
import { PricingSection } from '@/components/landing/PricingSection';
import { UrgencySection } from '@/components/landing/UrgencySection';
import { GuaranteeSection } from '@/components/landing/GuaranteeSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { FooterSection } from '@/components/landing/FooterSection';
import { FloatingYouTubeIcons } from '@/components/landing/YouTubePlayIcon';

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative">
      <FloatingYouTubeIcons />
      <ScrollProgress />
      <LandingNav />
      <HeroSection />
      <TrustBar />
      <TestimonialsSection />
      <FeaturesSection />
      <MonetizationSimulator />
      <PricingSection />
      <UrgencySection />
      <GuaranteeSection />
      <FaqSection />
      <FooterSection />
    </div>
  );
};

export default Index;
