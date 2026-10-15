import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import type { Direction } from '@shared/domain/quran/progress';
import { api, ApiError } from '../../lib/api';
import { useLedger } from '../../lib/useLedger';
import { Card, PageHeader } from '../../design/Card';
import { Button } from '../../design/Button';
import { SubNav } from '../../design/SubNav';
import { toast } from '../../stores/toasts';
import { JuzPicker } from './JuzPicker';
import { useQuran } from './useQuran';
import { LogPagesDialog } from './LogPagesDialog';

export function QuranPage() {
  const quran = useQuran();
  const goals = useLedger('goals.list', undefined, { domains: ['goals'] });
  const goal = goals.data?.find((g) => g.id === 'quran');
  const navigate = useNavigate();
  const [logging, setLogging] = useState(false);

  return (
    <div className="animate-fade-in pt-6" data-goal="quran">
      <PageHeader
        goal="quran"
        eyebrow="Goal A"
        title={goal?.title ?? 'Quran memorisation'}
        description={goal?.subtitle}
        actions={
          quran.setUp ? (
            <>
              <Button icon="plus" onClick={() => setLogging(true)}>
                Log new pages
              </Button>
              <Button
                variant="accent"
                icon="review"
                onClick={() => void navigate('/quran/revision')}
              >
                Revise
              </Button>
            </>
          ) : null
        }
      />
      {quran.ready && !quran.setUp ? (
        <SetupPanel />
      ) : (
        <>
          <SubNav
            label="Quran sections"
            items={[
              { to: '/quran', label: 'Overview', end: true },
              { to: '/quran/revision', label: 'Revision' },
              { to: '/quran/mushaf', label: 'Mushaf' },
              { to: '/quran/log', label: 'Learning log' },
            ]}
          />
          <Outlet />
        </>
      )}
      <LogPagesDialog open={logging} onClose={() => setLogging(false)} />
    </div>
  );
}

function SetupPanel() {
  const [juz, setJuz] = useState<number[]>([]);
  const [direction, setDirection] = useState<Direction>('backward');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api('quran.setup', { juz, direction });
      toast.success('Mushaf set up. Your first revision cycle is spread over the coming weeks.');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not set up the mushaf.');
      setSaving(false);
    }
  };
  return (
    <Card className="max-w-[680px] p-7">
      <h2 className="font-serif text-[22px] font-semibold">Set up your mushaf</h2>
      <p className="mt-2 mb-6 text-[13.5px] text-ink-muted">
        Mark the juz you have already memorised. Their first revision is spread across the coming
        weeks so you never face hundreds of pages at once. You can adjust individual pages later.
      </p>
      <JuzPicker
        selected={juz}
        onChange={setJuz}
        direction={direction}
        onDirectionChange={setDirection}
      />
      <div className="mt-7">
        <Button variant="accent" size="lg" disabled={saving} onClick={() => void save()}>
          {saving ? 'Setting up…' : 'Set up mushaf'}
        </Button>
      </div>
    </Card>
  );
}
