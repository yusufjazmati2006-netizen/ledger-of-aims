import { useApp, useSettings } from '../../stores/app';
import { toast } from '../../stores/toasts';
import { ApiError } from '../../lib/api';
import type { GameSettings } from '@shared/schemas/settings';
import { NumberField } from './NumberField';

export function GameSettingsSection() {
  const g = useSettings().game;
  const updateSettings = useApp((s) => s.updateSettings);
  const save = async (patch: Partial<GameSettings>) => {
    try {
      await updateSettings('game', patch);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save that setting.');
    }
  };
  return (
    <div className="grid grid-cols-2 gap-5" data-goal="game">
      <NumberField
        id="game-weekly-hours"
        label="Weekly hours target"
        hint="The reference line on the hours chart."
        integer={false}
        suffix="h"
        value={g.weeklyHoursTarget}
        min={0}
        max={80}
        onSave={(v) => save({ weeklyHoursTarget: v })}
      />
      <NumberField
        id="game-long-timer"
        label="Warn when a timer runs longer than"
        hint="A gentle check for a timer you forgot to stop."
        integer={false}
        suffix="h"
        value={g.longTimerHours}
        min={1}
        max={24}
        onSave={(v) => save({ longTimerHours: v })}
      />
    </div>
  );
}
