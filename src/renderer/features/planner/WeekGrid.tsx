import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { DayFrame } from '@shared/domain/planner/freeTime';
import { layoutLanes, type Lane } from '@shared/domain/planner/lanes';
import type { ProposedBlock } from '@shared/domain/planner/weekPlan';
import { durationLabel, fromMinutes } from '@shared/domain/time/clockTime';
import {
  addDays,
  diffDays,
  formatDate,
  weekdayShort,
  type LocalDate,
} from '@shared/domain/time/localDate';
import type { ShiftType } from '@shared/schemas/core';
import type { PlanBlock } from '@shared/schemas/degree';
import { cx } from '../../lib/cx';
import { GOAL_META } from '../../lib/goals';

/** The visible part of each day: 06:00 to midnight. */
export const VIEW_START = 6 * 60;
const VIEW_END = 24 * 60;
/** Pixels per minute. */
const PX = 0.75;
const SNAP = 15;
const y = (minute: number) => (Math.max(VIEW_START, Math.min(VIEW_END, minute)) - VIEW_START) * PX;
const HEIGHT = (VIEW_END - VIEW_START) * PX;

export interface WeekGridProps {
  frames: readonly DayFrame[];
  blocks: readonly PlanBlock[];
  preview: readonly ProposedBlock[];
  conflictIds: ReadonlySet<string>;
  today: LocalDate;
  nowMinute: number;
  shiftTypes: readonly ShiftType[];
  shiftTypeOn: (date: LocalDate) => string | null;
  onSetShift: (date: LocalDate, shiftTypeId: string | null) => void;
  onMove: (block: PlanBlock, date: LocalDate, start: number) => void;
  onOpen: (block: PlanBlock) => void;
}

/**
 * Seven day columns showing shifts (with commute), the hours kept for sleep, free
 * windows and planned blocks. Blocks are moved by dragging, or from the keyboard:
 * focus a block, press Space to pick it up, arrows to move (15 minutes / a day),
 * Space to drop, Escape to cancel. Enter opens it for editing.
 */
export function WeekGrid(props: WeekGridProps) {
  const { frames, blocks, preview, today } = props;
  const columns = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState('');
  const columnWidth = useRef(140);
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const first = frames[0]?.date ?? today;
  const last = frames[frames.length - 1]?.date ?? today;

  // Pointer drags use dnd-kit; keyboard moves are handled directly (below), because
  // dnd-kit's keyboard sensor scrolls the page instead of moving within a timeline.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [lifted, setLifted] = useState<Lifted | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const measure = () => {
    const column = columns.current?.querySelector('[data-day-column]');
    // Column width plus the gap between columns.
    if (column) columnWidth.current = column.getBoundingClientRect().width + 6;
  };

  const target = (block: PlanBlock, dx: number, dy: number) => {
    const days = Math.round(dx / columnWidth.current);
    const minutes = Math.round(dy / PX / SNAP) * SNAP;
    let date = addDays(block.date, days);
    if (date < first) date = first;
    if (date > last) date = last;
    const duration = block.end - block.start;
    const start = Math.max(0, Math.min(1440 - duration, block.start + minutes));
    return { date, start };
  };

  const onDragEnd = ({ active, delta }: DragEndEvent) => {
    const block = byId.get(String(active.id));
    if (!block) return;
    const { date, start } = target(block, delta.x, delta.y);
    if (date !== block.date || start !== block.start) props.onMove(block, date, start);
  };

  const describe = (id: string, dx: number, dy: number) => {
    const block = byId.get(id);
    if (!block) return '';
    const { date, start } = target(block, dx, dy);
    return `${block.title || 'Block'} at ${weekdayShort(date)} ${fromMinutes(start)}–${fromMinutes(start + block.end - block.start)}.`;
  };

  const at = (block: PlanBlock, date: LocalDate, start: number) =>
    `${block.title || 'Block'} at ${weekdayShort(date)} ${fromMinutes(start)}–${fromMinutes(start + block.end - block.start)}.`;

  const onBlockKey = (block: PlanBlock, e: KeyboardEvent<HTMLDivElement>) => {
    const current = lifted?.id === block.id ? lifted : null;
    if (!current) {
      if (e.key === 'Enter') {
        e.preventDefault();
        props.onOpen(block);
      } else if (e.key === ' ' && !block.done) {
        e.preventDefault();
        measure();
        setLifted({
          id: block.id,
          date: block.date,
          start: block.start,
          step: columnWidth.current,
        });
        setLive(`Picked up. ${at(block, block.date, block.start)}`);
      }
      return;
    }
    const duration = block.end - block.start;
    let { date, start } = current;
    switch (e.key) {
      case 'ArrowUp':
        start = Math.max(0, start - SNAP);
        break;
      case 'ArrowDown':
        start = Math.min(1440 - duration, start + SNAP);
        break;
      case 'ArrowLeft':
        date = addDays(date, -1) < first ? first : addDays(date, -1);
        break;
      case 'ArrowRight':
        date = addDays(date, 1) > last ? last : addDays(date, 1);
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        setLifted(null);
        setLive(`Dropped. ${at(block, date, start)}`);
        if (date !== block.date || start !== block.start) {
          setFocusId(block.id);
          props.onMove(block, date, start);
        }
        return;
      case 'Escape':
        e.preventDefault();
        setLifted(null);
        setLive('Move cancelled.');
        return;
      default:
        return;
    }
    e.preventDefault();
    setLifted({ ...current, date, start });
    setLive(at(block, date, start));
  };

  return (
    <GridContext.Provider
      value={{
        lifted,
        onBlockKey,
        focusId,
        cancelLift: () => setLifted(null),
      }}
    >
      <DndContext
        sensors={sensors}
        onDragStart={({ active }) => {
          measure();
          setLive(`Picked up. ${describe(String(active.id), 0, 0)}`);
        }}
        onDragMove={({ active, delta }) => setLive(describe(String(active.id), delta.x, delta.y))}
        onDragEnd={(event) => {
          setLive(`Dropped. ${describe(String(event.active.id), event.delta.x, event.delta.y)}`);
          onDragEnd(event);
        }}
        onDragCancel={() => setLive('Move cancelled.')}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Press Space to pick up the block. Use the arrow keys to move it by fifteen minutes or by a day, Space to drop it, or Escape to cancel. Press Enter to edit it.',
          },
          // Spoken through our own live region below, which knows the times.
          announcements: {
            onDragStart: () => '',
            onDragMove: () => '',
            onDragOver: () => '',
            onDragEnd: () => '',
            onDragCancel: () => '',
          },
        }}
      >
        <p className="sr-only" aria-live="assertive" role="status">
          {live}
        </p>
        <div className="grid grid-cols-[44px_1fr] gap-x-2">
          <div />
          <div className="grid grid-cols-7 gap-x-1.5">
            {frames.map((f) => (
              <DayHeader key={f.date} frame={f} {...props} />
            ))}
          </div>

          <div className="relative" style={{ height: HEIGHT }} aria-hidden="true">
            {Array.from(
              { length: (VIEW_END - VIEW_START) / 120 + 1 },
              (_, i) => VIEW_START + i * 120,
            ).map((m) => (
              <span
                key={m}
                className="tabular absolute right-0 -translate-y-1/2 text-[10.5px] text-ink-faint"
                style={{ top: y(m) }}
              >
                {m === VIEW_END ? '24:00' : fromMinutes(m)}
              </span>
            ))}
          </div>
          <div ref={columns} className="grid grid-cols-7 gap-x-1.5">
            {frames.map((f) => (
              <DayColumn
                key={f.date}
                {...props}
                frame={f}
                blocks={blocks.filter((b) => b.date === f.date)}
                preview={preview.filter((b) => b.date === f.date)}
              />
            ))}
          </div>
        </div>
      </DndContext>
    </GridContext.Provider>
  );
}

/** A block picked up from the keyboard, with where it would be dropped. */
interface Lifted {
  id: string;
  date: LocalDate;
  start: number;
  /** Width of a day column plus the gap, for horizontal moves. */
  step: number;
}

const GridContext = createContext<{
  lifted: Lifted | null;
  onBlockKey: (block: PlanBlock, e: KeyboardEvent<HTMLDivElement>) => void;
  focusId: string | null;
  cancelLift: () => void;
}>({
  lifted: null,
  onBlockKey: () => undefined,
  focusId: null,
  cancelLift: () => undefined,
});

function DayHeader({
  frame,
  today,
  shiftTypes,
  shiftTypeOn,
  onSetShift,
}: { frame: DayFrame } & WeekGridProps) {
  const label = `${weekdayShort(frame.date)} ${formatDate(frame.date, { year: false })}`;
  return (
    <div className="mb-2 min-w-0">
      <div
        className={cx(
          'text-[12.5px] font-semibold',
          frame.date === today ? 'text-accent' : 'text-ink',
        )}
      >
        {frame.date === today ? `Today · ${formatDate(frame.date, { year: false })}` : label}
      </div>
      <select
        aria-label={`Shift on ${label}`}
        className="mt-1 h-7 w-full rounded-md border border-control bg-surface px-1.5 text-[12px] text-ink"
        value={shiftTypeOn(frame.date) ?? ''}
        onChange={(e) => onSetShift(frame.date, e.target.value || null)}
      >
        <option value="">Not set</option>
        {shiftTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <div className="mt-1 text-[11.5px] text-ink-muted">
        {frame.shortSleep ? (
          <span className="font-semibold text-critical">Short sleep</span>
        ) : (
          `${durationLabel(frame.freeMinutes)} free`
        )}
      </div>
    </div>
  );
}

function DayColumn({
  frame,
  blocks,
  preview,
  today,
  nowMinute,
  conflictIds,
  onOpen,
}: { frame: DayFrame; blocks: readonly PlanBlock[]; preview: readonly ProposedBlock[] } & Omit<
  WeekGridProps,
  'blocks' | 'preview'
>) {
  const past = frame.date < today;
  const lanes = layoutLanes(blocks);
  return (
    <div
      data-day-column
      className={cx(
        'relative overflow-hidden rounded-lg border border-rule',
        past ? 'bg-sunken/60' : 'bg-surface',
      )}
      style={{ height: HEIGHT }}
      role="group"
      aria-label={`${weekdayShort(frame.date)} ${formatDate(frame.date, { year: false })}`}
    >
      {Array.from(
        { length: (VIEW_END - VIEW_START) / 60 },
        (_, i) => VIEW_START + (i + 1) * 60,
      ).map((m) => (
        <div
          key={m}
          className="absolute inset-x-0 border-t border-rule/60"
          style={{ top: y(m) }}
          aria-hidden="true"
        />
      ))}
      {frame.wake > VIEW_START ? (
        <Shade from={VIEW_START} to={frame.wake} label="Sleep and morning routine" />
      ) : null}
      {frame.bedtime < VIEW_END ? (
        <Shade from={frame.bedtime} to={VIEW_END} label="Wind-down and sleep" />
      ) : null}
      {frame.busy.map((b) => (
        <div
          key={`${b.start}`}
          className="absolute inset-x-0 flex items-start justify-center bg-[color-mix(in_srgb,var(--ink)_12%,transparent)] px-1 pt-1 text-center text-[10.5px] font-medium text-ink-muted"
          style={{ top: y(b.start), height: y(b.end) - y(b.start) }}
        >
          {frame.shift
            ? `Shift ${fromMinutes(frame.shift.start)}–${fromMinutes(frame.shift.end)}`
            : 'Busy'}
        </div>
      ))}
      {frame.date === today && nowMinute >= VIEW_START ? (
        <div
          className="absolute inset-x-0 z-20 h-[2px] bg-critical"
          style={{ top: y(nowMinute) }}
          aria-hidden="true"
        />
      ) : null}
      {preview.map((b) => (
        <div
          key={`${b.demand}-${b.start}`}
          data-goal={b.goalId}
          data-testid="proposed-block"
          className="absolute inset-x-1 z-10 overflow-hidden rounded-md border-2 border-dashed border-accent bg-accent-soft/70 px-1.5 py-px text-[11px] text-accent"
          style={{ top: y(b.start), height: Math.max(14, y(b.end) - y(b.start)) }}
        >
          <BlockText title={b.title} start={b.start} end={b.end} />
        </div>
      ))}
      {blocks.map((b) => (
        <BlockView
          key={b.id}
          block={b}
          lane={lanes.get(b.id) ?? { lane: 0, of: 1 }}
          conflict={conflictIds.has(b.id)}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

function Shade({ from, to, label }: { from: number; to: number; label: string }) {
  return (
    <div
      title={label}
      className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_srgb,var(--ink)_6%,transparent)_6px_7px)]"
      style={{ top: y(from), height: y(to) - y(from) }}
    />
  );
}

function BlockView({
  block,
  lane,
  conflict,
  onOpen,
}: {
  block: PlanBlock;
  lane: Lane;
  conflict: boolean;
  onOpen: (block: PlanBlock) => void;
}) {
  const grid = useContext(GridContext);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    disabled: block.done,
  });
  const node = useRef<HTMLDivElement | null>(null);
  const focusMe = grid.focusId === block.id;
  useEffect(() => {
    if (focusMe) node.current?.focus();
  }, [focusMe]);
  const lifted = grid.lifted?.id === block.id ? grid.lifted : null;
  const start = lifted?.start ?? block.start;
  const end = start + block.end - block.start;
  const days = lifted ? diffDays(block.date, lifted.date) : 0;
  const style: CSSProperties = {
    top: y(start),
    left: `calc(${(lane.lane / lane.of) * 100}% + 4px)`,
    width: `calc(${100 / lane.of}% - 8px)`,
    height: Math.max(16, y(end) - y(start)),
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : days !== 0
        ? `translateX(${days * (lifted?.step ?? 0)}px)`
        : undefined,
  };
  const label = `${block.title || GOAL_META[block.goalId].short}, ${weekdayShort(block.date)} ${fromMinutes(block.start)} to ${fromMinutes(block.end)}${block.done ? ', done' : ''}${block.pinned ? '' : ', proposed'}${conflict ? ', has a conflict' : ''}`;
  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        node.current = el;
      }}
      {...attributes}
      {...listeners}
      aria-label={label}
      aria-pressed={lifted !== null}
      data-goal={block.goalId}
      data-testid="plan-block"
      onClick={() => onOpen(block)}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => grid.onBlockKey(block, e)}
      onBlur={() => {
        if (lifted) grid.cancelLift();
      }}
      className={cx(
        'absolute z-10 cursor-grab overflow-hidden rounded-md border-l-[3px] border-accent px-1.5 py-px text-left text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-focus',
        block.done ? 'bg-sunken text-ink-faint line-through' : 'bg-accent-soft text-ink',
        conflict && 'ring-2 ring-critical',
        (isDragging || lifted) && 'z-30 cursor-grabbing shadow-lg',
      )}
      style={style}
    >
      <BlockText title={block.title || GOAL_META[block.goalId].short} start={start} end={end} />
    </div>
  );
}

/** Title and times; blocks too short for two lines put them on one. */
function BlockText({ title, start, end }: { title: string; start: number; end: number }) {
  if ((end - start) * PX < 30) {
    return (
      <div className="flex gap-1 truncate leading-tight">
        <span className="truncate font-semibold">{title}</span>
        <span className="tabular shrink-0 opacity-75">{fromMinutes(start)}</span>
      </div>
    );
  }
  return (
    <>
      <div className="truncate font-semibold">{title}</div>
      <div className="tabular truncate opacity-75">
        {fromMinutes(start)}–{fromMinutes(end)}
      </div>
    </>
  );
}
