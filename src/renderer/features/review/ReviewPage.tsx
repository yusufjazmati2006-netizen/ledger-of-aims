import { Outlet } from 'react-router';
import { PageHeader } from '../../design/Card';
import { SubNav } from '../../design/SubNav';

export function ReviewPage() {
  return (
    <div className="animate-fade-in pt-6">
      <PageHeader
        eyebrow="Once a week"
        title="Weekly review"
        description="Ten minutes once a week: what the numbers say, what you noticed, and three priorities for the week ahead."
      />
      <SubNav
        label="Review sections"
        items={[
          { to: '/review', label: 'This week', end: true },
          { to: '/review/history', label: 'History' },
          { to: '/review/habits', label: 'Habits' },
        ]}
      />
      <Outlet />
    </div>
  );
}
