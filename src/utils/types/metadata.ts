export interface MaterialMetadata {
  id: string;
  title: string;
  description?: string;
  avatar: string;
  estimatedDuration: number; // dakika cinsinden
  focusAreas: string[]; // simple-present, future-continuous, business, kitchen, etc.
  focusSkills: string[]; // writing, speaking, etc.
}

export const metadataSchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description:
        "The id of the material. It will be used to match answers and materails. Can be like 'm1', 'm2', 'quiz1', 'conv2' etc.",
    },
    title: { type: "string" },
    description: { type: "string" },
    estimatedDuration: { type: "number" },
    focusAreas: {
      type: "array",
      items: { type: "string" },
      description:
        "Focus areas of the material. It will be a grammaer rule, an area of life(business, kitchen, etc.), etc.",
    },
    focusSkills: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "writing",
          "speaking",
          "reading",
          "listening",
          "vocabulary",
          "grammar",
          "pronunciation",
          "listening",
          "speaking",
          "lettering", // For non-latin alphabets like Chinese, Japanese, Korean, Arabic etc.
        ],
      },

      description:
        "Skills that the material will focus on. It will be used to generate material.",
    },
  },
  required: ["title", "estimatedDuration", "focusAreas", "focusSkills", "id"],
  additionalProperties: false,
};
