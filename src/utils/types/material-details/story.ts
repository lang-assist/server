import { Schema } from "jsonschema";
import { MaterialDetails } from "../common";
import { QuizQuestion, quizQuestionSchema } from "./quiz";

export interface StoryPart {
  type: "NARRATIVE" | "PICTURE" | "AUDIO" | "QUESTION";
  picturePrompt?: string;
  ssml?: string;
  question?: QuizQuestion;
  pictureId?: string;
  audioId?: string;
}

const picturePartSchema: Schema = {
  type: "object",
  properties: {
    type: { type: "string", const: "PICTURE" },
    picturePrompt: { type: "string" },
  },
  required: ["type", "picturePrompt"],
  additionalProperties: false,
};

const audioPartSchema: Schema = {
  type: "object",
  properties: {
    type: { type: "string", const: "AUDIO" },
    ssml: { type: "string" },
  },
  required: ["type", "ssml"],
  additionalProperties: false,
};

export interface StoryDetails extends MaterialDetails {
  parts: (StoryPart | QuizQuestion)[];
}

export const storyDetailsSchema = {
  type: "object",
  properties: {
    parts: {
      type: "array",
      items: {
        oneOf: [
          picturePartSchema,
          audioPartSchema,
          {
            type: "object",
            properties: {
              type: { type: "string", const: "QUESTION" },
              question: { $ref: "#/definitions/QuizQuestion" },
            },
            required: ["type", "question"],
            additionalProperties: false,
          },
        ],
      },
    },
  },

  required: ["parts"],
  additionalProperties: false,
};
