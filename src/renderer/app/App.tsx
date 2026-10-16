import { useEffect } from 'react';
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
import { MilestonesPage } from '../features/milestones/MilestonesPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { NotFound } from './NotFound';
import { QuranPage } from '../features/quran/QuranPage';
import { QuranOverview } from '../features/quran/QuranOverview';
import { RevisionPage } from '../features/quran/RevisionPage';
import { MushafPage } from '../features/quran/MushafPage';
import { LearningLogPage } from '../features/quran/LearningLogPage';
import { PhysiquePage } from '../features/physique/PhysiquePage';
import { WeightPage } from '../features/physique/WeightPage';
import { TrainingPage } from '../features/physique/TrainingPage';
import { NutritionPage } from '../features/physique/NutritionPage';
import { MealPrepPage } from '../features/physique/MealPrepPage';
import { PhotosPage } from '../features/physique/PhotosPage';
import { DegreePage } from '../features/degree/DegreePage';
import { DegreeOverview } from '../features/degree/DegreeOverview';
import { ModulesPage } from '../features/degree/ModulesPage';
import { CalendarPage } from '../features/degree/CalendarPage';
import { StudyPage } from '../features/degree/StudyPage';
import { GamePage } from '../features/game/GamePage';
import { RoadmapPage } from '../features/game/RoadmapPage';
import { LearningPage } from '../features/game/LearningPage';
import { PracticePage } from '../features/game/PracticePage';
import { TimePage } from '../features/game/TimePage';
import { DevlogPage } from '../features/game/DevlogPage';
import { SteamPage } from '../features/game/SteamPage';
import { PlannerPage } from '../features/planner/PlannerPage';
import { ReviewPage } from '../features/review/ReviewPage';
import { ReviewWeekPage } from '../features/review/ReviewWeekPage';
import { HistoryPage } from '../features/review/HistoryPage';
import { HabitsPage } from '../features/review/HabitsPage';

const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <TodayPage /> },
      {
        path: 'quran',
        element: <QuranPage />,
        children: [
          { index: true, element: <QuranOverview /> },
          { path: 'revision', element: <RevisionPage /> },
          { path: 'mushaf', element: <MushafPage /> },
          { path: 'log', element: <LearningLogPage /> },
        ],
      },
      {
        path: 'physique',
        element: <PhysiquePage />,
        children: [
          { index: true, element: <WeightPage /> },
          { path: 'training', element: <TrainingPage /> },
          { path: 'nutrition', element: <NutritionPage /> },
          { path: 'meal-prep', element: <MealPrepPage /> },
          { path: 'photos', element: <PhotosPage /> },
        ],
      },
      {
        path: 'game',
        element: <GamePage />,
        children: [
          { index: true, element: <RoadmapPage /> },
          { path: 'learning', element: <LearningPage /> },
          { path: 'practice', element: <PracticePage /> },
          { path: 'time', element: <TimePage /> },
          { path: 'devlog', element: <DevlogPage /> },
          { path: 'steam', element: <SteamPage /> },
        ],
      },
      {
        path: 'degree',
        element: <DegreePage />,
        children: [
          { index: true, element: <DegreeOverview /> },
          { path: 'modules', element: <ModulesPage /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'study', element: <StudyPage /> },
        ],
      },
      { path: 'planner', element: <PlannerPage /> },
      {
        path: 'review',
        element: <ReviewPage />,
        children: [
          { index: true, element: <ReviewWeekPage /> },
          { path: 'history', element: <HistoryPage /> },
          { path: 'habits', element: <HabitsPage /> },
        ],
      },
      { path: 'milestones', element: <MilestonesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

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
  if (status === 'recovery') return <RecoveryScreen />;

  return (
    <>
      {onboarded ? <RouterProvider router={router} /> : <Onboarding />}
      <Toaster />
      <Celebration />
    </>
  );
}
