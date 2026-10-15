import { useEffect, useRef, useState } from 'react';
import { diffDays, formatDate, localDateOf } from '@shared/domain/time/localDate';
import { useCelebration } from '../../stores/celebration';
import { useLedger } from '../../lib/useLedger';
import { Ring } from '../../design/Ring';
import { Button } from '../../design/Button';
import { GOAL_META } from '../../lib/goals';

/**
 * A quiet acknowledgement when a milestone is reached: the goal's ring closes
 * slowly and a single serif line names what was achieved. No confetti, no sound.
 * Under reduced motion the ring is simply complete.
 */
export function Celebration() {
  const milestone = useCelebration((s) => s.queue[0]);
  const dismiss = useCelebration((s) => s.dismiss);
  const goals = useLedger('goals.list', undefined, { domains: ['goals'] });
  const ref = useRef<HTMLDialogElement>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (milestone && !dialog.open) {
      dialog.showModal();
      setFilled(false);
      const frame = requestAnimationFrame(() => {
        setFilled(true);
      });
      return () => {
        cancelAnimationFrame(frame);
      };
    }
    if (!milestone && dialog.open) dialog.close();
    return undefined;
  }, [milestone]);

  const goal = goals.data?.find((g) => g.id === milestone?.goalId);
  const completedOn = milestone?.completedAt ? localDateOf(new Date(milestone.completedAt)) : null;
  const early = milestone && completedOn ? diffDays(completedOn, milestone.targetDate) : 0;

  return (
    <dialog
      ref={ref}
      data-goal={milestone?.goalId}
      aria-labelledby="celebration-title"
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
      className="m-auto w-[440px] rounded-2xl border border-rule bg-surface p-0 text-ink shadow-[0_30px_80px_rgb(0_0_0/0.22)] backdrop:bg-scrim"
    >
      {milestone ? (
        <div className="animate-scale-in flex flex-col items-center px-10 pt-10 pb-8 text-center">
          <Ring value={filled ? 1 : 0} size={88} stroke={5} label="Milestone complete">
            <span className="text-accent">
              {/* A small mark of the goal at the centre of the closing ring */}
              <svg
                width="26"
                height="26"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m4.75 10.5 3.5 3.5 7-8" />
              </svg>
            </span>
          </Ring>
          <p className="eyebrow mt-6 !text-accent">
            {goal?.title ?? GOAL_META[milestone.goalId].short}
          </p>
          <h2
            id="celebration-title"
            className="mt-2 font-serif text-[26px] leading-tight font-semibold"
          >
            {milestone.title}
          </h2>
          <p className="mt-3 text-[13.5px] text-ink-muted">
            {early > 0
              ? `Reached ${early} day${early === 1 ? '' : 's'} before ${formatDate(milestone.targetDate)}.`
              : early === 0
                ? `Reached on the day it was due.`
                : `Reached — ${formatDate(milestone.targetDate)} was the target. It still counts.`}
          </p>
          <Button variant="accent" className="mt-7" autoFocus onClick={dismiss}>
            Continue
          </Button>
        </div>
      ) : null}
    </dialog>
  );
}
