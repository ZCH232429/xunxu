export type HealthDashboardModel = {
  date: string;
  updatedAt: string;
  calorieDeficit: number;
  activeEnergy: number;
  fatBurnZoneMinutes: number;
  sleepDuration: number;
  steps: number | null;
  restingHeartRate: number | null;
  totalSleepDuration: number | null;
  baseEnergy: number;
  intake: number;
  targetDeficit: number;
  ringProgress: number;
  intakeComplete: boolean;
  zone: [number, number];
  coverageMinutes: number;
  available: {activeEnergy: boolean; heartRate: boolean; sleep: boolean};
  sources: string[];
  warnings: string[];
};

// Read authorization is deliberately opaque in HealthKit. noData never implies permission granted.
export type HealthDashboardState =
  | {status: 'isLoading'}
  | {status: 'needsPermission'}
  | {status: 'noData'; message: string}
  | {status: 'success'; data: HealthDashboardModel}
  | {status: 'unavailable'; message: string}
  | {status: 'error'; message: string};
