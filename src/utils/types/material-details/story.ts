import { MaterialDetails } from "../common";

export interface StoryDetails extends MaterialDetails {
  text: string;
  audioUrl: string;
  vocabulary: string[];
  comprehensionQuestions: string[];
}

export const storyDetailsSchema = {
  type: "object",
  properties: {
    text: { type: "string" },
    audioUrl: { type: "string" },
    vocabulary: { type: "array", items: { type: "string" } },
    comprehensionQuestions: { type: "array", items: { type: "string" } },
  },
  required: ["text", "audioUrl", "vocabulary", "comprehensionQuestions"],
  additionalProperties: false,
};
