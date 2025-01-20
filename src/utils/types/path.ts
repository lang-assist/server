export type PathType = "PROFESSION" | "GENERAL" | "INITIAL";

export type PathLevel = {
  listening: number; // 0-100
  reading: number; // 0-100
  speaking: number; // 0-100
  writing: number; // 0-100
  grammar: number; // 0-100
  vocabulary: number; // 0-100
};

export const pathLevelSchema = {
  type: "object",
  properties: {
    listening: { type: "number" },
    reading: { type: "number" },
    speaking: { type: "number" },
    writing: { type: "number" },
    grammar: { type: "number" },
    vocabulary: { type: "number" },
  },
  required: [],
  additionalProperties: false,
};

export interface PathProgress {
  level: PathLevel;
  completedActivities: number;
  weakPoints: string[];
  strongPoints: string[];
  observations: string[];
}
