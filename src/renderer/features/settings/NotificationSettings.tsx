import { useState } from 'react';
import type { NotificationSettings, SystemSettings } from '@shared/schemas/settings';
import { useApp, useSettings } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';
import { api, ApiError } from '../../lib/api';
import { cx } from '../../lib/cx';
import { toast } from '../../stores/toasts';
import { Button } from '../../design/Button';
import { Note, Pill } from '../../design/Card';
import { Field, Switch, TextInput } from '../../design/Field';
import { NumberField } from './NumberField';
import { TimeField } from './DegreePlannerSettings';
import { acceleratorFrom } from './accelerator';

function useSave<K extends 'notifications' | 'system'>(namespace: K) {
  const updateSettings = useApp((s) => s.updateSettings);
  return async (
    patch: Partial<K extends 'notifications' ? NotificationSettings : SystemSettings>,
  ) => {
    try {
      await updateSettings(namespace, patch as never);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save that setting.');
    }
  };
}

type Timed = 'revision' | 'weighIn' | 'training' | 'weeklyReview';
const TIMED: { key: Timed; label: string; description: string }[] = [
  {
    key: 'revision',
    label: 'Quran revision',
    description: 'When pages are due and none are revised yet.',
  },
  { key: 'weighIn', label: 'Weigh-in', description: 'If you have not weighed in today.' },
  { key: 'training', label: 'Training day', description: 'When a session is due or overdue.' },
  {
    key: 'weeklyReview',
    label: 'Weekly review',
    description: 'On the last day of the week, until done.',
  },
];

export function NotificationSettingsSection() {
  const n = useSettings().notifications;
  const save = useSave('notifications');
  const status = useLedger('system.status', undefined, { domains: ['settings'] });
  const [days, setDays] = useState(n.deadlines.daysBefore.join(', '));
  const [daysError, setDaysError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <Switch
        checked={n.enabled}
        onChange={(enabled) => void save({ enabled })}
        label="Reminders"
        description="Shown only while Ledger of Aims is running (it can stay in the menu bar). Nothing is sent anywhere."
      />
      {status.data && !status.data.notificationsSupported ? (
        <Note tone="warning" icon="alert">
          This system does not support notifications.
        </Note>
      ) : null}
      <div className={cx('flex flex-col gap-5', !n.enabled && 'pointer-events-none opacity-50')}>
        <div className="grid grid-cols-2 gap-5">
          <TimeField
            id="nt-quiet-start"
            label="Quiet hours from"
            value={n.quietStart}
            onSave={(v) => void save({ quietStart: v })}
          />
          <TimeField
            id="nt-quiet-end"
            label="until"
            value={n.quietEnd}
            onSave={(v) => void save({ quietEnd: v })}
          />
        </div>
        <Switch
          checked={n.respectShifts}
          onChange={(respectShifts) => void save({ respectShifts })}
          label="Hold reminders during shifts and sleep"
          description="A reminder due during a shift, or before you are up after a night shift, waits until you are free."
        />
        <div className="flex flex-col divide-y divide-rule rounded-xl border border-rule">
          {TIMED.map((t) => (
            <div key={t.key} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Switch
                  checked={n[t.key].enabled}
                  onChange={(enabled) => void save({ [t.key]: { ...n[t.key], enabled } })}
                  label={t.label}
                  description={t.description}
                />
              </div>
              <TextInput
                type="time"
                aria-label={`${t.label} reminder time`}
                className="w-[110px]"
                defaultValue={n[t.key].time}
                disabled={!n[t.key].enabled}
                onBlur={(e) => {
                  const time = e.target.value;
                  if (/^\d{2}:\d{2}$/.test(time) && time !== n[t.key].time)
                    void save({ [t.key]: { ...n[t.key], time } });
                }}
              />
            </div>
          ))}
          <div className="flex items-start gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Switch
                checked={n.deadlines.enabled}
                onChange={(enabled) => void save({ deadlines: { ...n.deadlines, enabled } })}
                label="Degree deadlines"
                description="Days before each deadline (0 is the day itself)."
              />
            </div>
            <Field label="" error={daysError} className="w-[110px]">
              <TextInput
                aria-label="Days before a deadline"
                value={days}
                disabled={!n.deadlines.enabled}
                onChange={(e) => setDays(e.target.value)}
                onBlur={() => {
                  const list = days
                    .split(/[,\s]+/)
                    .filter(Boolean)
                    .map(Number);
                  if (
                    list.length > 6 ||
                    list.some((d) => !Number.isInteger(d) || d < 0 || d > 60)
                  ) {
                    setDaysError('Up to six whole days, 0–60.');
                    return;
                  }
                  setDaysError(null);
                  const daysBefore = [...new Set(list)].sort((a, b) => b - a);
                  setDays(daysBefore.join(', '));
                  void save({ deadlines: { ...n.deadlines, daysBefore } });
                }}
              />
            </Field>
          </div>
          <div className="flex items-start gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Switch
                checked={n.planBlocks.enabled}
                onChange={(enabled) => void save({ planBlocks: { ...n.planBlocks, enabled } })}
                label="Planned blocks"
                description="Shortly before each block in today’s plan."
              />
            </div>
            <NumberField
              id="nt-lead"
              label="Minutes before"
              value={n.planBlocks.leadMinutes}
              min={0}
              max={120}
              onSave={(leadMinutes) => save({ planBlocks: { ...n.planBlocks, leadMinutes } })}
            />
          </div>
          <div className="px-4 py-3">
            <Switch
              checked={n.longTimer.enabled}
              onChange={(enabled) => void save({ longTimer: { enabled } })}
              label="Forgotten game timer"
              description="When the timer has run longer than the limit in Settings → Game."
            />
          </div>
        </div>
        <div>
          <Button
            size="sm"
            icon="bolt"
            onClick={() =>
              void api('notifications.test').then(({ supported }) => {
                if (!supported) toast.error('Notifications are not available on this system.');
              })
            }
          >
            Send a test notification
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SystemSettingsSection() {
  const system = useSettings().system;
  const save = useSave('system');
  const status = useLedger('system.status', undefined, { domains: ['settings'] });
  const [recording, setRecording] = useState(false);
  const shown = system.quickLogShortcut;
  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Quick-log shortcut"
        htmlFor="sys-shortcut"
        hint="Works from any app: press it, type “w 72.4” or “g 45m”, press Return."
      >
        <div className="flex items-center gap-2">
          <button
            id="sys-shortcut"
            type="button"
            aria-label={
              recording
                ? 'Press the new shortcut'
                : `Quick-log shortcut: ${shown || 'none'}. Click to change.`
            }
            onClick={() => setRecording(true)}
            onBlur={() => setRecording(false)}
            onKeyDown={(e) => {
              if (!recording) return;
              e.preventDefault();
              if (e.key === 'Escape') {
                setRecording(false);
                return;
              }
              const accelerator = acceleratorFrom(e);
              if (accelerator) {
                setRecording(false);
                void save({ quickLogShortcut: accelerator });
              }
            }}
            className={cx(
              'h-9 min-w-[200px] rounded-lg border px-3 text-left font-mono text-[13px]',
              recording
                ? 'border-focus ring-[3px] ring-focus/25 text-ink-muted'
                : 'border-control text-ink',
            )}
          >
            {recording ? 'Press keys…' : shown || 'None'}
          </button>
          {shown ? (
            <Button size="sm" variant="ghost" onClick={() => void save({ quickLogShortcut: '' })}>
              Turn off
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void save({ quickLogShortcut: 'Control+Shift+Space' })}
            >
              Restore default
            </Button>
          )}
          {status.data && shown ? (
            status.data.shortcutRegistered ? (
              <Pill tone="positive">Active</Pill>
            ) : (
              <Pill tone="warning" icon="alert">
                In use by another app
              </Pill>
            )
          ) : null}
        </div>
      </Field>
      <Switch
        checked={system.menuBar}
        onChange={(menuBar) => void save({ menuBar })}
        label="Show in the menu bar"
        description="Quick log, the game timer (with its running time) and shortcuts into the app."
      />
    </div>
  );
}
