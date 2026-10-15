import { Outlet } from 'react-router';
import { useLedger } from '../../lib/useLedger';
import { PageHeader } from '../../design/Card';
import { SubNav } from '../../design/SubNav';
import { NextActionBanner } from './NextActionBanner';

export function GamePage() {
  const goals = useLedger('goals.list', undefined, { domains: ['goals'] });
  const goal = goals.data?.find((g) => g.id === 'game');
  return (
    <div className="animate-fade-in pt-6" data-goal="game">
      <PageHeader
        goal="game"
        eyebrow="Goal B"
        title={goal?.title ?? 'First game on Steam'}
        description={goal?.subtitle}
      />
      {goal ? <NextActionBanner goal={goal} /> : null}
      <SubNav
        label="Game sections"
        items={[
          { to: '/game', label: 'Roadmap', end: true },
          { to: '/game/learning', label: 'Learning path' },
          { to: '/game/practice', label: 'Practice projects' },
          { to: '/game/time', label: 'Time' },
          { to: '/game/devlog', label: 'Devlog' },
          { to: '/game/steam', label: 'Steam readiness' },
        ]}
      />
      <Outlet />
    </div>
  );
}
