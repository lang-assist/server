import { MaterialDetails } from "../common";

export interface QuizDetails extends MaterialDetails {
  questions: QuizQuestion[];
  preludes?: QuizPrelude[];
}

export const quizPreludeSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    parts: {
      type: "array",
      items: {
        oneOf: [
          {
            type: "object",
            properties: {
              type: { type: "string", const: "STORY" },
              content: { type: "string" },
            },
            required: ["type", "content"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", const: "PICTURE" },
              picturePrompt: { type: "string" },
            },
            required: ["type", "picturePrompt"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              type: { type: "string", const: "AUDIO" },
              content: { type: "string" },
            },
            required: ["type", "content"],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  required: ["id", "parts"],
  additionalProperties: false,
};

export type QuizPreludeItemType = "STORY" | "PICTURE" | "AUDIO";

export interface QuizPrelude {
  id: string;
  parts: {
    type: QuizPreludeItemType;
    content?: string;
    picturePrompt?: string;
    pictureId?: string;
    audioId?: string;
  }[];
}

export type QuizQuestionType =
  | "MULTIPLE_CHOICE"
  | "CHOICE"
  | "TRUE_FALSE"
  | "FILL_CHOICE"
  | "FILL_WRITE"
  | "MATCHING"
  | "ORDERING"
  | "TEXT_INPUT_WRITE"
  | "RECORD";

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  question: string;
  preludeID?: string;
  choices?: QuestionItem[]; // For multiple choice, choice, fill-choice, text-input-choice
  items?: QuestionItem[]; // for matching, ordering
  secondItems?: QuestionItem[]; // for matching
}

export interface QuestionItem {
  id: string;
  text: string;
  picturePrompt?: string;
  pictureId?: string;
}

export const questionItemSchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
    },
    text: { type: "string" },
    picturePrompt: {
      type: "string",
    },
  },
  required: ["id", "text"],
  additionalProperties: false,
};

export const questionItemRef = {
  $ref: "#/definitions/QuestionItem",
};

export function quizQuestionSchema(type: QuizQuestionType) {
  const otherProperties: any = {};

  const requiredProperties = ["type", "question", "id"];

  if (
    type === "MULTIPLE_CHOICE" ||
    type === "CHOICE" ||
    type === "FILL_CHOICE"
  ) {
    otherProperties.choices = { type: "array", items: questionItemRef };
    requiredProperties.push("choices");
  }

  if (type === "MATCHING") {
    otherProperties.items = { type: "array", items: questionItemRef };
    otherProperties.secondItems = { type: "array", items: questionItemRef };
    requiredProperties.push("items", "secondItems");
  }

  if (type === "ORDERING") {
    otherProperties.items = { type: "array", items: questionItemRef };
    requiredProperties.push("items");
  }

  return {
    type: "object",
    properties: {
      id: {
        type: "string",
      },
      type: {
        type: "string",
        const: type,
      },
      question: {
        type: "string",
      },
      preludeID: {
        type: "string",
      },
      ...otherProperties,
    },
    required: requiredProperties,
    additionalProperties: false,
  };
}

export const quizQuestionsSchema = {
  oneOf: [
    quizQuestionSchema("MULTIPLE_CHOICE"),
    quizQuestionSchema("CHOICE"),
    quizQuestionSchema("TRUE_FALSE"),
    quizQuestionSchema("FILL_CHOICE"),
    quizQuestionSchema("FILL_WRITE"),
    quizQuestionSchema("MATCHING"),
    quizQuestionSchema("ORDERING"),
    quizQuestionSchema("TEXT_INPUT_WRITE"),
    quizQuestionSchema("RECORD"),
  ],
};


export const quizDetailsSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        $ref: "#/definitions/QuizQuestion",
      },
    },
    preludes: {
      type: "array",
      items: quizPreludeSchema,
    },
  },
  required: ["questions"],
  additionalProperties: false,
};
