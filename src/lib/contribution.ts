// 贡献值 · 简化版：积分为 ContributionEvent 之和，等级由积分派生（不缓存，避免漂移）。

export const LEVEL_THRESHOLDS = [0, 50, 150, 400, 1000, 2000] as const;

export const LEVEL_TITLES = [
  "萌新",
  "活跃",
  "贡献者",
  "资深",
  "核心",
  "传奇",
] as const;

export const CONTRIBUTION_TYPES = [
  "CITED",
  "MATERIAL",
  "QUALITY_POST",
  "OTHER",
] as const;

export type ContributionTypeValue = (typeof CONTRIBUTION_TYPES)[number];

export const CONTRIBUTION_TYPE_LABELS: Record<ContributionTypeValue, string> = {
  CITED: "帖子被引用",
  MATERIAL: "提供资料",
  QUALITY_POST: "优质发帖",
  OTHER: "其他贡献",
};

// 等级从 0 开始：0 分 = Lv.0（萌新），达到下一阈值升一级。
export function levelForPoints(points: number): number {
  let level = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (points >= LEVEL_THRESHOLDS[i]) level = i;
  }
  return level;
}

export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(Math.max(level, 0), LEVEL_TITLES.length - 1)];
}

export interface LevelProgress {
  level: number;
  title: string;
  points: number;
  currentBase: number;
  nextThreshold: number | null;
  toNext: number | null;
  percent: number;
  isMax: boolean;
}

export function levelProgress(points: number): LevelProgress {
  const safePoints = Math.max(0, Math.floor(points || 0));
  const level = levelForPoints(safePoints);
  const currentBase = LEVEL_THRESHOLDS[level] ?? 0;
  const isMax = level >= LEVEL_THRESHOLDS.length - 1;
  const nextThreshold = isMax ? null : LEVEL_THRESHOLDS[level + 1];

  if (nextThreshold === null) {
    return {
      level,
      title: levelTitle(level),
      points: safePoints,
      currentBase,
      nextThreshold: null,
      toNext: null,
      percent: 100,
      isMax: true,
    };
  }

  const span = nextThreshold - currentBase;
  const percent =
    span > 0
      ? Math.min(100, Math.max(0, Math.round(((safePoints - currentBase) / span) * 100)))
      : 0;

  return {
    level,
    title: levelTitle(level),
    points: safePoints,
    currentBase,
    nextThreshold,
    toNext: Math.max(0, nextThreshold - safePoints),
    percent,
    isMax: false,
  };
}
