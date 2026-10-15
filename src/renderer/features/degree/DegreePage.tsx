import { Outlet } from 'react-router';
import { useLedger } from '../../lib/useLedger';
import { PageHeader } from '../../design/Card';
import { SubNav } from '../../design/SubNav';

export function DegreePage() {
  const goals = useLedger('goals.list', undefined, { domains: ['goals'] });
  const goal = goals.data?.find((g) => g.id === 'degree');
  return (
    <div className="animate-fade-in pt-6" data-goal="degree">
      <PageHeader
        goal="degree"
        eyebrow="Goal C"
        title={goal?.title ?? 'Business management degree'}
        description={goal?.subtitle}
      />
      <SubNav
        label="Degree sections"
        items={[
          { to: '/degree', label: 'Overview', end: true },
          { to: '/degree/modules', label: 'Modules' },
          { to: '/degree/calendar', label: 'Calendar' },
          { to: '/degree/study', label: 'Study' },
        ]}
      />
      <Outlet />
    </div>
  );
}
