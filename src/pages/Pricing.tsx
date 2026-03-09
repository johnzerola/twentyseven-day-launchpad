import { LandingNav } from '@/components/landing/LandingNav';
import { PricingSection } from '@/components/landing/PricingSection';
import { FooterSection } from '@/components/landing/FooterSection';

const Pricing = () => {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <div className="pt-20">
        <PricingSection />
      </div>
      <FooterSection />
    </div>
  );
};

export default Pricing;
