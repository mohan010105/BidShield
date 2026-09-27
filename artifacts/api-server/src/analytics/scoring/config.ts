/**
 * Configurable thresholds and analytical parameters for Phase 3 screening.
 * No statistical threshold is hardcoded in detection logic.
 */

export interface ScreenerConfig {
  methodologyVersion: string;
  priceClusteringMethodologyVersion: string;
  neatLossMethodologyVersion: string;

  // Screening Status score thresholds (0 - 100)
  thresholds: {
    lowMax: number;       // < 30 => LOW INDICATOR
    moderateMax: number;  // 30 - 59 / 64 => MODERATE INDICATOR
    elevatedMax: number;  // 60 / 65 - 84 => ELEVATED INDICATOR
    highMin: number;      // >= 80 / 85 => HIGH INDICATOR
  };

  // Sample size safety minimums
  sampleRequirements: {
    minRotationComparableTenders: number;   // Minimum comparable tenders needed for rotation assessment (default 3)
    minCoverBidHistoricalTenders: number;   // Minimum historical comparable observations for repeated proximity (default 2)
    minBidsPerTenderForScreening: number;   // Minimum bids in target tender (default 2)
    minBidsForPriceClustering: number;      // Minimum bids in target tender for price clustering (default 3)
    minComparableForPriceClustering: number;// Minimum comparable tenders for historical baseline (default 5)
    minNeatLossObservations: number;        // Minimum losing observations for neat loss screening (default 5)
    preferredNeatLossObservations: number;  // Preferred observations for robust statistical assessment (default 8)
  };

  // Comparable Tender Similarity Weights & Thresholds
  comparable: {
    categoryWeight: number;
    organizationWeight: number;
    departmentWeight: number;
    stateWeight: number;
    valueRangeWeight: number;
    timeWindowWeight: number;
    minSimilarityThreshold: number; // Tenders with similarity >= this are considered comparable
    maxValueRatio: number;          // Max estimated value ratio allowed for comparable comparison (e.g. 5x)
    maxTimeWindowMonths: number;    // Max time window in months for comparison (e.g. 36 months)
  };

  // Winner Rotation Engine Weights
  winnerRotation: {
    alternationFrequencyWeight: number;
    winnerTransitionPatternWeight: number;
    repeatedGroupRateWeight: number;
    winnerConcentrationWeight: number;
    sequenceRegularityWeight: number;
    reviewThreshold: number; // default 65
  };

  // Cover-Bid Engine Weights
  coverBid: {
    historicalProximityWeight: number;
    tightClusteringWeight: number;
    consistentDeltaWeight: number;
    spreadAnomalyWeight: number;
    repeatedDeltaTolerancePct: number; // e.g., ±1.5% from historical median
    reviewThreshold: number;           // default 65
  };

  // Price Clustering Engine Weights
  priceClustering: {
    tenderConcentrationWeight: number;
    historicalComparisonWeight: number;
    percentileDeviationWeight: number;
    relativeDistanceWeight: number;
    repeatedPositioningWeight: number;
    reviewThreshold: number;           // default 60
    tightCvThreshold: number;          // default 0.015 (1.5% CV)
    tightSpreadPctThreshold: number;   // default 3.0 (3.0% relative spread)
  };

  // Participation Network Engine Weights & Thresholds
  network: {
    coParticipationWeight: number;
    persistentGroupWeight: number;
    participationConcentrationWeight: number;
    multiAttributeRecurrenceWeight: number;
    reviewThreshold: number;           // default 60
    minSharedTendersForPattern: number;// default 2
    minGroupSize: number;              // default 3
  };

  // Phase 6: Too-Neat Losing Bid Engine Weights & Thresholds
  neatLoss: {
    lossRateWeight: number;            // default 0.15
    gapConsistencyWeight: number;      // default 0.35
    rankRepetitionWeight: number;      // default 0.25
    nearWinnerWeight: number;          // default 0.15
    groupRepetitionWeight: number;     // default 0.10
    reviewThreshold: number;           // default 50
    tightGapCvThreshold: number;       // default 0.15 (15% CV)
    narrowMarginPctThreshold: number;  // default 2.5%
    maxRelativeGapSpreadPct: number;   // default 1.5%
  };

  combinedRiskMethodologyVersion: string;

  // Phase 7: Combined Risk Engine Weights & Thresholds
  combinedRisk: {
    minIndependentIndicators: number; // default 2
    weights: {
      rotation: number;               // default 0.20
      coverBid: number;               // default 0.20
      priceClustering: number;        // default 0.20
      network: number;                // default 0.20
      neatLoss: number;               // default 0.20
    };
    levels: {
      lowMax: number;                 // < 25 (0 - 24.99)
      moderateMax: number;            // 25 - 49.99
      elevatedMax: number;            // 50 - 74.99
      highMin: number;                // >= 75
    };
  };
}

export const defaultScreenerConfig: ScreenerConfig = {
  methodologyVersion: "v1.0",
  priceClusteringMethodologyVersion: "price_clustering_v1.0",
  neatLossMethodologyVersion: "neat_losing_bid_v1.0",
  combinedRiskMethodologyVersion: "combined_risk_v1.0",

  combinedRisk: {
    minIndependentIndicators: 2,
    weights: {
      rotation: 0.20,
      coverBid: 0.20,
      priceClustering: 0.20,
      network: 0.20,
      neatLoss: 0.20,
    },
    levels: {
      lowMax: 24.99,
      moderateMax: 49.99,
      elevatedMax: 74.99,
      highMin: 75.0,
    },
  },

  thresholds: {
    lowMax: 29,
    moderateMax: 59,
    elevatedMax: 79,
    highMin: 80,
  },

  sampleRequirements: {
    minRotationComparableTenders: 3,
    minCoverBidHistoricalTenders: 2,
    minBidsPerTenderForScreening: 2,
    minBidsForPriceClustering: 3,
    minComparableForPriceClustering: 5,
    minNeatLossObservations: 5,
    preferredNeatLossObservations: 8,
  },

  comparable: {
    categoryWeight: 0.35,
    organizationWeight: 0.25,
    departmentWeight: 0.15,
    stateWeight: 0.10,
    valueRangeWeight: 0.10,
    timeWindowWeight: 0.05,
    minSimilarityThreshold: 0.45,
    maxValueRatio: 6.0,
    maxTimeWindowMonths: 36,
  },

  winnerRotation: {
    alternationFrequencyWeight: 0.30,
    winnerTransitionPatternWeight: 0.25,
    repeatedGroupRateWeight: 0.25,
    winnerConcentrationWeight: 0.10,
    sequenceRegularityWeight: 0.10,
    reviewThreshold: 60,
  },

  coverBid: {
    historicalProximityWeight: 0.35,
    tightClusteringWeight: 0.25,
    consistentDeltaWeight: 0.25,
    spreadAnomalyWeight: 0.15,
    repeatedDeltaTolerancePct: 1.5,
    reviewThreshold: 60,
  },

  priceClustering: {
    tenderConcentrationWeight: 0.25,
    historicalComparisonWeight: 0.25,
    percentileDeviationWeight: 0.25,
    relativeDistanceWeight: 0.15,
    repeatedPositioningWeight: 0.10,
    reviewThreshold: 60,
    tightCvThreshold: 0.015,
    tightSpreadPctThreshold: 3.0,
  },

  network: {
    coParticipationWeight: 0.35,
    persistentGroupWeight: 0.25,
    participationConcentrationWeight: 0.20,
    multiAttributeRecurrenceWeight: 0.20,
    reviewThreshold: 60,
    minSharedTendersForPattern: 2,
    minGroupSize: 3,
  },

  neatLoss: {
    lossRateWeight: 0.15,
    gapConsistencyWeight: 0.35,
    rankRepetitionWeight: 0.25,
    nearWinnerWeight: 0.15,
    groupRepetitionWeight: 0.10,
    reviewThreshold: 50,
    tightGapCvThreshold: 0.15,
    narrowMarginPctThreshold: 2.5,
    maxRelativeGapSpreadPct: 1.5,
  },
};

