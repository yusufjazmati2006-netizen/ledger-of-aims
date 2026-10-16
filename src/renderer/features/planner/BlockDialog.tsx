import { useState } from 'react';
import { isClockTime, toMinutes, fromMinutes } from '@shared/domain/time/clockTime';
import { GOAL_IDS, type GoalId } from '@shared/schemas/common';
import type { PlanBlock } from '@shared/schemas/degree';
import { api, ApiError } from '../../lib/api';
import { completeBlock } from './completeBlock';
import { GOAL_META } from '../../lib/goals';
import { toast } from '../../stores/toasts';
import { Button } from '../../design/Button';
import { Dialog } from '../../design/Dialog';
import { Field, LabeledInput, Select, Switch } from '../../design/Field';

const KIND_TITLES: Record<GoalId, { kind: string; title: string }> = {
  quran: { kind: 'revision', title: 'Quran revision' },
  game: { kind: 'game', title: 'Game development' },
  degree: { kind: 'study', title: 'Study' },
  physique: { kind: 'training', title: 'Training' },
};

/** Adds a block, or edits one: times, title, done, and whether re-planning may move it. */
export function BlockDialog({
  block,
  date: initialDate,
  onClose,
}: {
  block: PlanBlock | null;
  date: string;
  onClose: () => void;
}) {
  const [goal, setGoal] = useState<GoalId>(block?.goalId ?? 'degree');
  const [title, setTitle] = useState(block?.title ?? KIND_TITLES.degree.title);
  const [date, setDate] = useState(block?.date ?? initialDate);
  const [start, setStart] = useState(block ? fromMinutes(block.start) : '19:00');
  const [end, setEnd] = useState(
    block ? (block.end === 1440 ? '24:00' : fromMinutes(block.end)) : '20:00',
  );
  const [done, setDone] = useState(block?.done ?? false);
  const [pinned, setPinned] = useState(block?.pinned ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const endMinutes = end === '24:00' ? 1440 : isClockTime(end) ? toMinutes(end) : null;
    if (!isClockTime(start) || endMinutes === null) {
      setError('Times are HH:MM, e.g. 19:30.');
      return;
    }
    const startMinutes = toMinutes(start);
    if (endMinutes <= startMinutes) {
      setError('A block must end after it starts (blocks cannot cross midnight).');
      return;
    }
    try {
      if (block) {
        if (done && !block.done) {
          await completeBlock({
            ...block,
            date,
            start: startMinutes,
            end: endMinutes,
            title: title.trim(),
          });
        }
        await api('plan.update', {
          id: block.id,
          patch: { date, start: startMinutes, end: endMinutes, title: title.trim(), done, pinned },
        });
      } else {
        await api('plan.create', {
          date,
          start: startMinutes,
          end: endMinutes,
          goalId: goal,
          kind: KIND_TITLES[goal].kind,
          title: title.trim(),
          pinned: true,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the block.');
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      goal={goal}
      width={460}
      title={block ? 'Edit block' : 'Add a block'}
      footer={
        <>
          {block ? (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() =>
                void api('plan.delete', { id: block.id }).then(() => {
                  toast.success('Block removed from the plan.');
                  onClose();
                })
              }
            >
              Remove
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {block ? null : (
          <Field label="Goal" htmlFor="block-goal">
            <Select
              id="block-goal"
              value={goal}
              onChange={(e) => {
                const next = e.target.value as GoalId;
                setGoal(next);
                setTitle(KIND_TITLES[next].title);
              }}
            >
              {GOAL_IDS.map((id) => (
                <option key={id} value={id}>
                  {GOAL_META[id].short}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <LabeledInput
          label="Title"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-3">
          <LabeledInput
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <LabeledInput
            label="From"
            placeholder="HH:MM"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <LabeledInput
            label="To"
            placeholder="HH:MM"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            error={error}
          />
        </div>
        {block ? (
          <>
            <Switch checked={done} onChange={setDone} label="Done" />
            <Switch
              checked={pinned}
              onChange={setPinned}
              label="Keep in place when re-planning"
              description="Blocks you add or move are kept automatically; proposed ones are replaced by the next proposal."
            />
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
