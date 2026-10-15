import { Outlet } from 'react-router';
import { useLedger } from '../../lib/useLedger';
import { PageHeader } from '../../design/Card';
import { SubNav } from '../../design/SubNav';

export function PhysiquePage() {
  const goals = useLedger('goals.list', undefined, { domains: ['goals'] });
  const goal = goals.data?.find((g) => g.id === 'physique');
  return (
    <div className="animate-fade-in pt-6" data-goal="physique">
      <PageHeader
        goal="physique"
        eyebrow="Goal D"
        title={goal?.title ?? 'Physique'}
        description={goal?.subtitle}
      />
      <SubNav
        label="Physique sections"
        items={[
          { to: '/physique', label: 'Weight', end: true },
          { to: '/physique/training', label: 'Training' },
          { to: '/physique/nutrition', label: 'Nutrition' },
          { to: '/physique/meal-prep', label: 'Meal prep' },
          { to: '/physique/photos', label: 'Photos' },
        ]}
      />
      <Outlet />
      <p className="mt-10 max-w-[70ch] text-[12px] text-ink-faint">
        Targets and checkpoints are estimates. Real progress is non-linear: it comes in steps and
        stalls, and lean gain slows as training age grows. Nothing here is medical or dietary advice
        — if anything feels wrong, speak to a professional.
      </p>
    </div>
  );
}
