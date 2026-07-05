export type IncomeRange =
  | 'under_50k'
  | '50_100k'
  | '100_150k'
  | '150_250k'
  | 'over_250k'
  | 'skip';

export type SpendingPreset =
  | 'frugal'
  | 'moderate'
  | 'comfortable'
  | 'under_40k'
  | '40_70k'
  | '70_100k'
  | '100_150k'
  | '150_plus'
  | 'custom'
  | 'skip';

export type SavingsCushion = 'none' | 'under_1m' | '1_3m' | '3m_plus' | 'skip';

export type OnboardingGoal =
  | 'control_spending'
  | 'save'
  | 'subscriptions'
  | 'investments'
  | 'explore'
  | 'skip';

export type OnboardingProfile = {
  incomeRange?: IncomeRange;
  spendingPreset?: SpendingPreset;
  monthlyBudget?: number | null;
  savingsCushion?: SavingsCushion;
  primaryGoal?: OnboardingGoal;
  completedAt: string;
};

export type OnboardingAnswers = {
  incomeRange: IncomeRange | null;
  spendingPreset: SpendingPreset | null;
  customBudget: string;
  savingsCushion: SavingsCushion | null;
  primaryGoal: OnboardingGoal | null;
};
