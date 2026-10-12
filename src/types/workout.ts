export type WorkoutSet = {
    id: string,
    weight: number,
    reps: number
};

export type BodyPart = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "legs" | "abs" | "other"; 

export type SubCategory = {
    id: string,
    name: string,
    bodyPart: BodyPart
};

export type Exercise = {
    id: string,
    name: string,
    bodyPart: BodyPart,
    subCategoryId: string | null,
    usesBodyWeight: boolean
};

export type DailyInfo = {
    date: string,
    bodyWeight: number | null
};

export type WorkoutRecord = {
    id: string,
    date: string,
    exerciseId: string,
    sets: WorkoutSet[],
    memo: string,
    usesBodyWeight: boolean
};

export type WorkoutSetInput = {
  id: string,
  weight: string,
  reps: string
};