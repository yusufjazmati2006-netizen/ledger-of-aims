import { useMemo } from 'react';
import { nutritionTargets, ageOn, type NutritionTargets } from '@shared/domain/physique/nutrition';
import {
  requiredWeeklyRate,
  targetWeightAt,
  type TrajectoryPoint,
} from '@shared/domain/physique/trajectory';
import {
  rateVerdict,
  smoothTrend,
  weeklyRate,
  type RateVerdict,
  type TrendPoint,
} from '@shared/domain/physique/trend';
import type { Milestone, WeighIn } from '@shared/schemas/core';
import { useSettings, useToday } from '../../stores/app';
import { useLedger } from '../../lib/useLedger';

export interface PhysiqueView {
  ready: boolean;
  today: string;
  weighIns: WeighIn[];
  trend: TrendPoint[];
  latest: TrendPoint | null;
  rate: number | null;
  required: number;
  verdict: RateVerdict;
  trajectory: TrajectoryPoint[];
  targetToday: number | null;
  checkpoints: Milestone[];
  nutrition: NutritionTargets | null;
  /** Weight used for formulas: the trend, else the latest weigh-in, else the start. */
  currentKg: number | null;
}

export function usePhysique(): PhysiqueView {
  const today = useToday();
  const settings = useSettings();
  const p = settings.physique;
  const weighIns = useLedger('weighIns.list', {}, { domains: ['weighIns'] });
  const milestones = useLedger('milestones.list', undefined, { domains: ['milestones'] });

  return useMemo(() => {
    const list = weighIns.data ?? [];
    const trend = smoothTrend(
      list.map((w) => ({ date: w.date, kg: w.weightKg })),
      p.trendAlpha,
    );
    const latest = trend[trend.length - 1] ?? null;
    const checkpoints = (milestones.data ?? [])
      .filter((m) => m.goalId === 'physique' && m.unit === 'kg' && m.targetValue !== null)
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
    const { startWeightKg, startDate } = settings.profile;
    const trajectory: TrajectoryPoint[] =
      startWeightKg !== null && startDate !== null
        ? [
            { date: startDate, kg: startWeightKg },
            ...checkpoints.map((m) => ({ date: m.targetDate, kg: m.targetValue ?? 0 })),
          ]
        : [];
    const currentKg = latest?.trend ?? list[list.length - 1]?.weightKg ?? startWeightKg;
    const rate = weeklyRate(trend);
    const required = requiredWeeklyRate(trajectory, today);
    const verdict = rateVerdict(rate, required, currentKg ?? 70, {
      fastMarginKg: p.fastMarginKg,
      slowMarginKg: p.slowMarginKg,
      maxWeeklyGainPct: p.maxWeeklyGainPct,
    });
    const nutrition =
      currentKg === null
        ? null
        : nutritionTargets({
            weightKg: currentKg,
            heightCm: p.heightCm,
            age: ageOn(p.birthYear, Number(today.slice(0, 4))),
            sex: p.sex,
            activityFactor: p.activityFactor,
            surplusKcal: p.surplusKcal,
            proteinPerKg: p.proteinPerKg,
            calorieOverride: p.calorieOverride,
            proteinOverride: p.proteinOverride,
          });
    return {
      ready: weighIns.data !== undefined && milestones.data !== undefined,
      today,
      weighIns: list,
      trend,
      latest,
      rate,
      required,
      verdict,
      trajectory,
      targetToday: targetWeightAt(trajectory, today),
      checkpoints,
      nutrition,
      currentKg,
    };
  }, [weighIns.data, milestones.data, p, settings.profile, today]);
}
