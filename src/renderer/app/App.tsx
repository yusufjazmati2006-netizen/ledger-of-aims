import { useEffect, type ComponentType } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import { useApp } from '../stores/app';
import { Toaster } from '../design/Toaster';
import { Celebration } from '../features/celebration/Celebration';
import { useCelebration } from '../stores/celebration';
import { onDataChanged } from '../lib/api';
import { Shell } from './Shell';
import { RecoveryScreen } from '../features/recovery/RecoveryScreen';
import { Onboarding } from '../features/onboarding/Onboarding';
import { TodayPage } from '../features/today/TodayPage';
import { NotFound } from './NotFound';
import { QuickLogWindow } from '../features/palette/QuickLogWindow';

/**
 * Screens load on first visit (each feature is its own chunk), so start-up parses only
 * the shell and Today. Chunks come from local disk, so a first visit is still instant.
 */
function page<M>(load: () => Promise<M>, pick: (m: M) => ComponentType) {
  return async () => ({ Component: pick(await load()) });
}
const quran = () => import('../features/quran/routes');
const physique = () => import('../features/physique/routes');
const game = () => import('../features/game/routes');
const degree = () => import('../features/degree/routes');
const review = () => import('../features/review/routes');

const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <TodayPage /> },
      {
        path: 'quran',
        lazy: page(quran, (m) => m.QuranPage),
        children: [
          { index: true, lazy: page(quran, (m) => m.QuranOverview) },
          { path: 'revision', lazy: page(quran, (m) => m.RevisionPage) },
          { path: 'mushaf', lazy: page(quran, (m) => m.MushafPage) },
          { path: 'log', lazy: page(quran, (m) => m.LearningLogPage) },
        ],
      },
      {
        path: 'physique',
        lazy: page(physique, (m) => m.PhysiquePage),
        children: [
          { index: true, lazy: page(physique, (m) => m.WeightPage) },
          { path: 'training', lazy: page(physique, (m) => m.TrainingPage) },
          { path: 'nutrition', lazy: page(physique, (m) => m.NutritionPage) },
          { path: 'meal-prep', lazy: page(physique, (m) => m.MealPrepPage) },
          { path: 'photos', lazy: page(physique, (m) => m.PhotosPage) },
        ],
      },
      {
        path: 'game',
        lazy: page(game, (m) => m.GamePage),
        children: [
          { index: true, lazy: page(game, (m) => m.RoadmapPage) },
          { path: 'learning', lazy: page(game, (m) => m.LearningPage) },
          { path: 'practice', lazy: page(game, (m) => m.PracticePage) },
          { path: 'time', lazy: page(game, (m) => m.TimePage) },
          { path: 'devlog', lazy: page(game, (m) => m.DevlogPage) },
          { path: 'steam', lazy: page(game, (m) => m.SteamPage) },
        ],
      },
      {
        path: 'degree',
        lazy: page(degree, (m) => m.DegreePage),
        children: [
          { index: true, lazy: page(degree, (m) => m.DegreeOverview) },
          { path: 'modules', lazy: page(degree, (m) => m.ModulesPage) },
          { path: 'calendar', lazy: page(degree, (m) => m.CalendarPage) },
          { path: 'study', lazy: page(degree, (m) => m.StudyPage) },
        ],
      },
      {
        path: 'planner',
        lazy: page(
          () => import('../features/planner/PlannerPage'),
          (m) => m.PlannerPage,
        ),
      },
      {
        path: 'review',
        lazy: page(review, (m) => m.ReviewPage),
        children: [
          { index: true, lazy: page(review, (m) => m.ReviewWeekPage) },
          { path: 'history', lazy: page(review, (m) => m.HistoryPage) },
          { path: 'habits', lazy: page(review, (m) => m.HabitsPage) },
        ],
      },
      {
        path: 'milestones',
        lazy: page(
          () => import('../features/milestones/MilestonesPage'),
          (m) => m.MilestonesPage,
        ),
      },
      {
        path: 'search',
        lazy: page(
          () => import('../features/search/SearchPage'),
          (m) => m.SearchPage,
        ),
      },
      {
        path: 'settings',
        lazy: page(
          () => import('../features/settings/SettingsPage'),
          (m) => m.SettingsPage,
        ),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

/** The same renderer serves the floating quick-log window, at #/quick. */
const isQuickWindow = window.location.hash.startsWith('#/quick');
if (isQuickWindow) document.documentElement.dataset.window = 'quick';

export function App() {
  const status = useApp((s) => s.status);
  const error = useApp((s) => s.error);
  const bootstrap = useApp((s) => s.bootstrap);
  const refreshToday = useApp((s) => s.refreshToday);
  const onboarded = useApp((s) => Boolean(s.settings?.onboarding.completedAt));
  const reduceMotion = useApp((s) => s.settings?.general.reduceMotion ?? false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Settings can change in the main process (e.g. mushaf set-up, or another window).
  const refreshSettings = useApp((s) => s.refreshSettings);
  useEffect(
    () =>
      onDataChanged((domains) => {
        if (domains.includes('settings')) void refreshSettings();
      }),
    [refreshSettings],
  );

  // Milestones completed automatically by the main process (e.g. "25 juz").
  const celebrate = useCelebration((s) => s.celebrate);
  useEffect(
    () =>
      window.ledger.on('milestone:completed', ({ milestone }) => {
        celebrate(milestone);
      }),
    [celebrate],
  );

  // Night shifts end after midnight, so "today" must roll over while the app is open.
  useEffect(() => {
    if (status !== 'ready') return;
    const tick = () => void refreshToday();
    const timer = setInterval(tick, 60_000);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, [status, refreshToday]);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
  }, [reduceMotion]);

  const theme = useApp((s) => s.settings?.general.theme ?? 'system');
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  if (status === 'loading') return <div className="h-full bg-paper" aria-busy="true" />;
  if (status === 'error') {
    return (
      <div className="flex h-full items-center justify-center bg-paper p-10 text-center">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Ledger of Aims could not start</h1>
          <p className="mt-2 text-ink-muted">{error}</p>
        </div>
      </div>
    );
  }
  if (status === 'recovery') return isQuickWindow ? null : <RecoveryScreen />;
  if (isQuickWindow) return <QuickLogWindow onboarded={onboarded} />;

  return (
    <>
      {onboarded ? <RouterProvider router={router} /> : <Onboarding />}
      <Toaster />
      <Celebration />
    </>
  );
}
