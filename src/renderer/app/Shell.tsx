import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { NAV_ITEMS, SETTINGS_PATH, type NavItem } from '@shared/nav';
import { Icon, type IconName } from '../design/icons';
import { cx } from '../lib/cx';
import { useLedger } from '../lib/useLedger';

const NAV_ICONS: Record<string, IconName> = {
  '/': 'today',
  '/quran': 'book',
  '/physique': 'dumbbell',
  '/degree': 'cap',
  '/game': 'gamepad',
  '/planner': 'calendar',
  '/review': 'review',
  '/milestones': 'flag',
  '/search': 'search',
  [SETTINGS_PATH]: 'settings',
};

function NavEntry({
  item,
  index,
  badge,
}: {
  item: NavItem;
  index?: number;
  badge?: { label: string } | null;
}) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      data-goal={item.goal}
      className={({ isActive }) =>
        cx(
          'group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors duration-150',
          isActive
            ? 'bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] font-medium text-ink'
            : 'text-ink-muted hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-ink',
        )
      }
    >
      <Icon
        name={NAV_ICONS[item.path] ?? 'chevronRight'}
        size={17}
        className={item.goal ? 'text-accent' : undefined}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {badge ? (
        <span
          role="status"
          aria-label={badge.label}
          title={badge.label}
          className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent"
        />
      ) : null}
      {index !== undefined && index < 9 ? (
        <span className="text-[11px] text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
          ⌘{index + 1}
        </span>
      ) : null}
    </NavLink>
  );
}

export function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const timer = useLedger('time.running', undefined, { domains: ['game'] });

  // The application menu (⌘1–⌘9, Settings…) navigates via main-process events.
  useEffect(
    () =>
      window.ledger.on('navigate', ({ path }) => {
        void navigate(path);
      }),
    [navigate],
  );

  useEffect(() => {
    document.getElementById('main')?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex h-full">
      <aside className="flex w-[236px] shrink-0 flex-col border-r border-rule bg-sidebar">
        <div className="drag-region h-[52px] shrink-0" />
        <div className="px-5 pb-5">
          <div className="font-serif text-[19px] leading-tight font-semibold tracking-[-0.01em] text-ink">
            Ledger <span className="font-normal text-ink-muted italic">of</span> Aims
          </div>
        </div>
        <nav aria-label="Sections" className="flex flex-col gap-0.5 px-3">
          {NAV_ITEMS.map((item, index) => (
            <NavEntry
              key={item.path}
              item={item}
              index={index}
              badge={item.path === '/game' && timer.data ? { label: 'Game timer running' } : null}
            />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5 px-3 pb-4">
          <NavEntry item={{ path: SETTINGS_PATH, label: 'Settings' }} />
          <div
            className="mt-2 flex items-center gap-2 px-2.5 text-[11.5px] text-ink-faint"
            title="Ledger of Aims makes no network requests. Your data stays on this Mac."
          >
            <Icon name="lock" size={13} />
            Private · offline
          </div>
        </div>
      </aside>
      <main id="main" className="relative min-w-0 flex-1 overflow-y-auto bg-paper">
        <div className="drag-region sticky top-0 z-10 h-[30px]" />
        <div className="mx-auto max-w-[1120px] px-12 pb-20">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
