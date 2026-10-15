export type WeightUnit = 'kg' | 'lb';

const KG_PER_LB = 0.45359237;

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

export function formatWeight(kg: number, unit: WeightUnit, digits = 1): string {
  return `${kgToUnit(kg, unit).toFixed(digits)} ${unit}`;
}

/** Parses a user-typed number, accepting a comma as the decimal separator. */
export function parseDecimal(text: string): number | null {
  const normalised = text.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalised)) return null;
  const value = Number(normalised);
  return Number.isFinite(value) ? value : null;
}
