export type Group = 'biceps' | 'back' | 'abs';
export type Equipment = 'dumbbell' | 'barbell' | 'cable' | 'machine' | 'plate' | 'bodyweight';

export interface Exercise {
  id: string;
  name: string;
  group: Group;
  equipment: Equipment;
  /** Timed exercises (plank) log seconds instead of reps. */
  unit: 'reps' | 'sec';
  /** Weight step for the +/- buttons, in lb. */
  increment: number;
  defaultWeight: number;
  defaultReps: number;
  /** Not in Gid's notes, but worth rotating in. */
  why?: string;
  /** Shown under the name, e.g. how the weight is counted. */
  note?: string;
}

const ex = (e: Exercise) => e;

export const EXERCISES: Exercise[] = [
  // Biceps
  ex({ id: 'db-curl', name: 'Dumbbell curl', group: 'biceps', equipment: 'dumbbell', unit: 'reps', increment: 5, defaultWeight: 25, defaultReps: 10 }),
  ex({ id: 'zottman-curl', name: 'Zottman curl', group: 'biceps', equipment: 'dumbbell', unit: 'reps', increment: 5, defaultWeight: 20, defaultReps: 10 }),
  ex({ id: 'hammer-curl', name: 'Hammer curl', group: 'biceps', equipment: 'dumbbell', unit: 'reps', increment: 5, defaultWeight: 25, defaultReps: 10 }),
  ex({ id: 'plate-curl', name: 'Plate curl', group: 'biceps', equipment: 'plate', unit: 'reps', increment: 10, defaultWeight: 35, defaultReps: 10 }),
  ex({ id: 'seated-barbell-curl', name: 'Seated barbell curl', group: 'biceps', equipment: 'barbell', unit: 'reps', increment: 5, defaultWeight: 35, defaultReps: 10, note: 'Plates on the bar (17.5 a side = 35)' }),
  ex({ id: 'cross-body-curl', name: 'Cross-body dumbbell curl', group: 'biceps', equipment: 'dumbbell', unit: 'reps', increment: 5, defaultWeight: 25, defaultReps: 10 }),
  ex({ id: 'incline-curl', name: 'Incline dumbbell curl', group: 'biceps', equipment: 'dumbbell', unit: 'reps', increment: 5, defaultWeight: 20, defaultReps: 10, why: 'Stretches the long head; good when the bench is free' }),
  ex({ id: 'ez-curl', name: 'EZ-bar curl', group: 'biceps', equipment: 'barbell', unit: 'reps', increment: 5, defaultWeight: 50, defaultReps: 10 }),
  ex({ id: 'preacher-curl', name: 'Preacher curl', group: 'biceps', equipment: 'machine', unit: 'reps', increment: 5, defaultWeight: 40, defaultReps: 10, why: 'No swinging; isolates the lower biceps' }),
  ex({ id: 'cable-curl', name: 'Cable curl', group: 'biceps', equipment: 'cable', unit: 'reps', increment: 5, defaultWeight: 40, defaultReps: 12 }),
  ex({ id: 'bayesian-curl', name: 'Bayesian cable curl', group: 'biceps', equipment: 'cable', unit: 'reps', increment: 5, defaultWeight: 20, defaultReps: 12, why: 'Cable behind you: tension at full stretch' }),
  ex({ id: 'concentration-curl', name: 'Concentration curl', group: 'biceps', equipment: 'dumbbell', unit: 'reps', increment: 5, defaultWeight: 20, defaultReps: 10 }),
  ex({ id: 'spider-curl', name: 'Spider curl', group: 'biceps', equipment: 'dumbbell', unit: 'reps', increment: 5, defaultWeight: 20, defaultReps: 10 }),

  // Back
  ex({ id: 'bent-row', name: 'Bent-over row', group: 'back', equipment: 'barbell', unit: 'reps', increment: 5, defaultWeight: 95, defaultReps: 10 }),
  ex({ id: 'pull-up', name: 'Pull-up', group: 'back', equipment: 'bodyweight', unit: 'reps', increment: 5, defaultWeight: 0, defaultReps: 8 }),
  ex({ id: 'seated-row', name: 'Seated cable row', group: 'back', equipment: 'cable', unit: 'reps', increment: 5, defaultWeight: 90, defaultReps: 10 }),
  ex({ id: 'lat-pulldown', name: 'Lat pulldown', group: 'back', equipment: 'cable', unit: 'reps', increment: 5, defaultWeight: 110, defaultReps: 10 }),
  ex({ id: 'assisted-pull-up', name: 'Assisted pull-up', group: 'back', equipment: 'machine', unit: 'reps', increment: 5, defaultWeight: 50, defaultReps: 10, note: 'Weight = assistance (lower is harder)' }),
  ex({ id: 'row-machine', name: 'Row machine', group: 'back', equipment: 'machine', unit: 'reps', increment: 5, defaultWeight: 110, defaultReps: 10 }),
  ex({ id: 'rear-delt-machine', name: 'Rear delt machine', group: 'back', equipment: 'machine', unit: 'reps', increment: 5, defaultWeight: 70, defaultReps: 12 }),
  ex({ id: 'one-arm-cable-row', name: 'One-arm cable row', group: 'back', equipment: 'cable', unit: 'reps', increment: 5, defaultWeight: 90, defaultReps: 10 }),
  ex({ id: 'db-back-fly', name: 'Dumbbell back fly', group: 'back', equipment: 'dumbbell', unit: 'reps', increment: 5, defaultWeight: 25, defaultReps: 12 }),
  ex({ id: 'back-extension', name: 'Back extension', group: 'back', equipment: 'plate', unit: 'reps', increment: 5, defaultWeight: 10, defaultReps: 12 }),
  ex({ id: 'one-arm-row', name: 'Single-arm dumbbell row', group: 'back', equipment: 'dumbbell', unit: 'reps', increment: 5, defaultWeight: 50, defaultReps: 10, why: 'Only needs a bench and one dumbbell' }),
  ex({ id: 'chest-supported-row', name: 'Chest-supported row', group: 'back', equipment: 'machine', unit: 'reps', increment: 5, defaultWeight: 70, defaultReps: 10, why: 'Easier on the lower back than bent-over rows' }),
  ex({ id: 'tbar-row', name: 'T-bar row', group: 'back', equipment: 'machine', unit: 'reps', increment: 5, defaultWeight: 70, defaultReps: 10 }),
  ex({ id: 'chin-up', name: 'Chin-up', group: 'back', equipment: 'bodyweight', unit: 'reps', increment: 5, defaultWeight: 0, defaultReps: 8, why: 'Hits biceps and lats together' }),
  ex({ id: 'straight-arm-pulldown', name: 'Straight-arm pulldown', group: 'back', equipment: 'cable', unit: 'reps', increment: 5, defaultWeight: 40, defaultReps: 12 }),
  ex({ id: 'face-pull', name: 'Face pull', group: 'back', equipment: 'cable', unit: 'reps', increment: 5, defaultWeight: 40, defaultReps: 15, why: 'Rear delts and posture; a light finisher' }),

  // Abs
  ex({ id: 'hanging-leg-raise', name: 'Hanging leg raise', group: 'abs', equipment: 'bodyweight', unit: 'reps', increment: 5, defaultWeight: 0, defaultReps: 12 }),
  ex({ id: 'cable-crunch', name: 'Cable crunch', group: 'abs', equipment: 'cable', unit: 'reps', increment: 5, defaultWeight: 60, defaultReps: 15 }),
  ex({ id: 'ab-wheel', name: 'Ab wheel rollout', group: 'abs', equipment: 'bodyweight', unit: 'reps', increment: 5, defaultWeight: 0, defaultReps: 10 }),
  ex({ id: 'plank', name: 'Plank', group: 'abs', equipment: 'bodyweight', unit: 'sec', increment: 5, defaultWeight: 0, defaultReps: 60 }),
  ex({ id: 'decline-situp', name: 'Decline sit-up', group: 'abs', equipment: 'bodyweight', unit: 'reps', increment: 5, defaultWeight: 0, defaultReps: 15 }),
  ex({ id: 'dead-bug', name: 'Dead bug', group: 'abs', equipment: 'bodyweight', unit: 'reps', increment: 5, defaultWeight: 0, defaultReps: 12 }),
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function exercise(id: string): Exercise {
  return (
    BY_ID.get(id) ?? {
      id,
      name: id,
      group: 'biceps',
      equipment: 'dumbbell',
      unit: 'reps',
      increment: 5,
      defaultWeight: 0,
      defaultReps: 10,
    }
  );
}

export const GROUP_LABEL: Record<Group, string> = { biceps: 'Biceps', back: 'Back', abs: 'Abs' };

/** "25 lb", "BW", "BW+25" */
export function weightLabel(ex: Exercise, weight: number): string {
  if (ex.equipment === 'bodyweight') return weight > 0 ? `BW+${weight}` : 'BW';
  return `${weight} lb`;
}

/** "25×10", "BW×8", "60s" */
export function setLabel(ex: Exercise, weight: number, reps: number): string {
  if (ex.unit === 'sec') return weight > 0 ? `${weight}lb ${reps}s` : `${reps}s`;
  const w = ex.equipment === 'bodyweight' ? (weight > 0 ? `BW+${weight}` : 'BW') : `${weight}`;
  return `${w}×${reps}`;
}
