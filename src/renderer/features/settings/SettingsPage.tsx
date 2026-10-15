import { useState, type ReactNode } from 'react';
import { weekdayNameLong } from '@shared/domain/time/localDate';
import { isClockTime } from '@shared/domain/time/clockTime';
import type { ShiftType } from '@shared/schemas/core';
import { useApp, useSettings } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { api, ApiError } from '../../lib/api';
import { toast } from '../../stores/toasts';
import { Card, PageHeader } from '../../design/Card';
import { Field, SegmentedControl, Select, Switch, TextInput } from '../../design/Field';
import { Button } from '../../design/Button';
import { Icon } from '../../design/icons';
import { QuranSettingsSection } from './QuranSettings';

function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid grid-cols-[220px_1fr] gap-8 border-t border-rule py-7 first:border-t-0 first:pt-0"
    >
      <div>
        <h2 id={id} className="font-serif text-[17px] font-semibold text-ink">
          {title}
        </h2>
        {description ? <p className="mt-1 text-[12.5px] text-ink-muted">{description}</p> : null}
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const settings = useSettings();
  const info = useApp((s) => s.info);
  const updateSettings = useApp((s) => s.updateSettings);
  const update = (patch: Parameters<typeof updateSettings<'general'>>[1]) => {
    void updateSettings('general', patch).catch(() => {
      toast.error('Could not save that setting.');
    });
  };

  return (
    <div className="animate-fade-in pt-6">
      <PageHeader title="Settings" description="Ledger of Aims keeps every setting on this Mac." />
      <Card className="px-7 py-7">
        <SettingsSection id="appearance" title="Appearance" description="Follows macOS by default.">
          <Field label="Theme">
            <SegmentedControl
              label="Theme"
              value={settings.general.theme}
              onChange={(theme) => {
                update({ theme });
              }}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </Field>
          <Switch
            label="Reduce motion"
            description="Turns off transitions and animations. macOS’s own Reduce Motion setting is always respected."
            checked={settings.general.reduceMotion}
            onChange={(reduceMotion) => {
              update({ reduceMotion });
            }}
          />
        </SettingsSection>

        <SettingsSection id="units" title="Units & calendar">
          <Field
            label="Weight unit"
            hint="Weights are always stored in kilograms; this changes display and entry."
          >
            <SegmentedControl
              label="Weight unit"
              value={settings.general.units}
              onChange={(units) => {
                update({ units });
              }}
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
            />
          </Field>
          <Field label="Week starts on" htmlFor="week-start">
            <Select
              id="week-start"
              className="max-w-[220px]"
              value={settings.general.weekStartsOn}
              onChange={(e) => {
                update({ weekStartsOn: Number(e.target.value) });
              }}
            >
              {[1, 0, 6].map((d) => (
                <option key={d} value={d}>
                  {weekdayNameLong(d)}
                </option>
              ))}
            </Select>
          </Field>
        </SettingsSection>

        <SettingsSection
          id="quran"
          title="Quran"
          description="Revision time, pace and the spaced-repetition scheduler. Every formula is shown with its parameters."
        >
          <QuranSettingsSection />
        </SettingsSection>

        <SettingsSection
          id="shifts"
          title="Shift definitions"
          description="Used by the planner and the Today screen. A night shift may end after midnight."
        >
          <ShiftEditor />
        </SettingsSection>

        <SettingsSection id="privacy" title="Data & privacy">
          <PrivacyPanel />
          <div>
            <div className="text-[12.5px] font-medium text-ink-muted">Data folder</div>
            <div className="mt-1 flex items-center gap-3">
              <code className="selectable min-w-0 flex-1 truncate rounded-md bg-sunken px-2.5 py-1.5 font-mono text-[12px] text-ink">
                {info?.dataPath}
              </code>
              <Button size="sm" icon="folder" onClick={() => void api('app.revealDataFolder')}>
                Reveal
              </Button>
            </div>
          </div>
          <p className="text-[12px] text-ink-faint">
            Ledger of Aims {info?.version} ·{' '}
            {info?.isPackaged ? 'release build' : 'development build'}
          </p>
        </SettingsSection>
      </Card>
    </div>
  );
}

function ShiftEditor() {
  const types = useLedger('shifts.types', undefined, { domains: ['shifts'] });
  return (
    <div className="flex flex-col gap-3">
      {types.data
        ?.filter((t) => t.start !== null)
        .map((t) => (
          // Keyed by the stored hours so the row's local inputs reset when they change.
          <ShiftRow key={`${t.id}:${t.start ?? ''}:${t.end ?? ''}`} type={t} />
        ))}
    </div>
  );
}

function ShiftRow({ type }: { type: ShiftType }) {
  const [start, setStart] = useState(type.start ?? '');
  const [end, setEnd] = useState(type.end ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = async (next: { start?: string; end?: string }) => {
    const s = next.start ?? start;
    const e = next.end ?? end;
    if (!isClockTime(s) || !isClockTime(e)) {
      setError('Use 24-hour times such as 07:30.');
      return;
    }
    setError(null);
    try {
      await api('shifts.updateType', { id: type.id, patch: { start: s, end: e } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.');
    }
  };

  return (
    <div className="flex items-end gap-3">
      <div className="w-24 pb-2 text-[13.5px] font-medium text-ink">{type.label}</div>
      <Field label="Starts" htmlFor={`${type.id}-start`}>
        <TextInput
          id={`${type.id}-start`}
          type="time"
          className="w-[120px]"
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
          }}
          onBlur={(e) => void save({ start: e.target.value })}
        />
      </Field>
      <Field label="Ends" htmlFor={`${type.id}-end`}>
        <TextInput
          id={`${type.id}-end`}
          type="time"
          className="w-[120px]"
          value={end}
          onChange={(e) => {
            setEnd(e.target.value);
          }}
          onBlur={(e) => void save({ end: e.target.value })}
        />
      </Field>
      {end && start && end < start ? (
        <span className="pb-2 text-[12px] text-ink-faint">ends the next day</span>
      ) : null}
      {error ? (
        <span role="alert" className="pb-2 text-[12px] text-critical">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function PrivacyPanel() {
  const log = useLedger('diagnostics.networkLog', undefined);
  const blocked = log.data?.blocked ?? [];
  return (
    <div className="flex items-start gap-3 rounded-lg bg-sunken px-4 py-3">
      <Icon name="lock" size={16} className="mt-0.5 shrink-0 text-ink-muted" />
      <div className="text-[13px]">
        <div className="font-medium text-ink">No network access</div>
        <p className="mt-0.5 text-ink-muted">
          No accounts, no cloud, no telemetry. Every outgoing request is blocked at the source and
          recorded here.{' '}
          <span className="tabular font-medium text-ink" data-testid="network-blocked-count">
            {blocked.length === 0
              ? 'Nothing has been blocked this session.'
              : `${blocked.length} request${blocked.length === 1 ? '' : 's'} blocked this session.`}
          </span>
        </p>
      </div>
    </div>
  );
}
