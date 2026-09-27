import { ScreenerConfig, defaultScreenerConfig } from "./config";
import { ScreeningStatus } from "../common/types";
import { round } from "../common/statistics";

/**
 * Determine the qualitative screening status from a 0-100 score according to config.
 */
export function scoreToScreeningStatus(
  score: number | null,
  isInsufficientData: boolean,
  config: ScreenerConfig = defaultScreenerConfig
): ScreeningStatus {
  if (isInsufficientData || score === null || isNaN(score)) {
    return "INSUFFICIENT_DATA";
  }
  if (score >= config.thresholds.highMin) {
    return "HIGH INDICATOR";
  }
  if (score >= config.thresholds.moderateMax + 1) {
    return "ELEVATED INDICATOR";
  }
  if (score >= config.thresholds.lowMax + 1) {
    return "MODERATE INDICATOR";
  }
  return "LOW INDICATOR";
}

/**
 * Normalizes a computed weighted raw value (typically 0.0 - 1.0) to a 0-100 integer score.
 */
export function normalizeScore(rawValue: number): number {
  const bounded = Math.max(0, Math.min(1, rawValue));
  return Math.round(bounded * 100);
}

/**
 * Computes sample size confidence multiplier (0.4 - 1.0)
 * Increases as sample size exceeds the minimum threshold.
 */
export function computeSampleConfidence(
  sampleSize: number,
  minRequired: number,
  optimalSize: number = 8
): number {
  if (sampleSize < minRequired) return 0.2;
  if (sampleSize >= optimalSize) return 1.0;
  const progress = (sampleSize - minRequired) / (optimalSize - minRequired);
  return round(0.5 + progress * 0.5, 2);
}
