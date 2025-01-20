import { MaterialDetails } from "../common";

export interface QuizDetails extends MaterialDetails {
  questions: QuizQuestion[];
  preludes?: QuizPrelude[];
}

export const quizPreludeSchema = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["STORY"],
    },
    id: { type: "string" },
    parts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["STORY", "PICTURE"] },
          content: { type: "string" },
          picturePrompt: { type: "string" },
          pictureId: { type: "string" },
        },
        required: ["type"],
        additionalProperties: false,
      },
    },
  },
  required: ["id", "type", "parts"],
  additionalProperties: false,
};

export type QuizPreludeItemType = "STORY" | "PICTURE";

export interface QuizPrelude {
  id: string;
  parts: {
    type: QuizPreludeItemType;
    content?: string;
    picturePrompt?: string;
    pictureId?: string;
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
  | "TEXT_INPUT_CHOICE";

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
      description: "for identify answer. can be a1, a2 etc. DONT duplicate id.",
    },
    text: { type: "string", description: "the user facing text of the item" },
    picturePrompt: {
      type: "string",
    },
    pictureID: {
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
    type === "FILL_CHOICE" ||
    type === "TEXT_INPUT_CHOICE"
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
        description:
          "The id of the question. MUST be unique in the material. DONT duplicate id. It will be used to identify the question in the answer. Can be 'q1', 'text1', 'q2', 'text2' etc.",
      },
      type: {
        type: "string",
        const: type,
      },
      question: {
        type: "string",
        description: "The question user facing text",
      },
      preludeID: {
        type: "string",
        description:
          "ID of the connected prelude. If the question requires a preliminary information, the prelude id should be included here. Prelude id MUST be in the preludes array. ",
      },
      ...otherProperties,
    },
    required: requiredProperties,
    additionalProperties: false,
  };
}

export const quizDetailsSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        oneOf: [
          quizQuestionSchema("MULTIPLE_CHOICE"),
          quizQuestionSchema("CHOICE"),
          quizQuestionSchema("TRUE_FALSE"),
          quizQuestionSchema("FILL_CHOICE"),
          quizQuestionSchema("FILL_WRITE"),
          quizQuestionSchema("MATCHING"),
          quizQuestionSchema("ORDERING"),
          quizQuestionSchema("TEXT_INPUT_WRITE"),
          quizQuestionSchema("TEXT_INPUT_CHOICE"),
        ],
      },
    },
    preludes: {
      type: "array",
      items: quizPreludeSchema,
      description:
        "If more than one question requires a preliminary information, the preliminary information should be included here. For example, a story is told and 3 questions are asked in this context. The questions also reference the prelude with the prelude id. If multiple questions are not in one context, there is no need for a prelude.",
    },
  },
  required: ["questions"],
  additionalProperties: false,
};
