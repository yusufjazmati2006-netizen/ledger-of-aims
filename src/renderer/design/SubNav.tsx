import { NavLink } from 'react-router';
import { cx } from '../lib/cx';

/** Secondary navigation within a goal (Overview / Revision / …). */
export function SubNav({
  items,
  label,
}: {
  items: { to: string; label: string; end?: boolean }[];
  label: string;
}) {
  return (
    <nav aria-label={label} className="mb-7 flex gap-1 border-b border-rule">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cx(
              '-mb-px border-b-2 px-3 pb-2.5 text-[13.5px] transition-colors duration-150',
              isActive
                ? 'border-accent font-medium text-ink'
                : 'border-transparent text-ink-muted hover:text-ink',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
