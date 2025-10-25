import { HeroSection } from '@/components/hero-section';
import { FeaturesSection } from '@/components/features-section';

export default function Page() {
  return (
    <main className="bg-background min-h-dvh">
      <div className="grid place-items-center px-4">
        <HeroSection />
        <FeaturesSection />
      </div>
    </main>
  );
}
