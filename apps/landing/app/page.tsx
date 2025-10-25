import { HeroSection } from '@/components/hero-section';
import { FeaturesSection } from '@/components/features-section';
import { RoadmapSection } from '@/components/roadmap-section';

export default function Page() {
  return (
    <main id="main" className="bg-background min-h-dvh">
      <div className="grid place-items-center px-4">
        <HeroSection />
        <FeaturesSection />
        <RoadmapSection />
      </div>
    </main>
  );
}
