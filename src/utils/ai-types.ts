import { ValidationError } from "jsonschema";
import {
  MaterialDetails,
  materialDetailsDefs,
  MaterialMetadata,
  materialSchema,
  PathLevel,
  pathLevelSchema,
} from "./types";

export type AIModels = "gpt-4o" | "gpt-4o-mini";

export interface AIGeneratedMaterialResponse {
  details: MaterialDetails;
  metadata: MaterialMetadata;
}

export const aiObservationEditSchema = {
  type: "object",
  properties: {
    add: {
      type: "array",
      items: { type: "string" },
      description: "The terms to add",
    },
    remove: {
      type: "array",
      items: { type: "string" },
      description: "The terms to remove",
    },
    replace: {
      type: "array",
      items: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 2,
        description:
          "The term [old in [0]] to replace and the new term [new in [1]]",
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

export interface AIObservationEdit {
  add?: string[];
  remove?: string[];
  replace?: string[][];
}

export interface AIGenerationResponse {
  newMaterials?: AIGeneratedMaterialResponse[];
  newLevel?: PathLevel;
  observations?: AIObservationEdit;
  weakPoints?: AIObservationEdit;
  strongPoints?: AIObservationEdit;
  feedbacks?: AIFeedbackInterface[];
  // newDictionaryItems?: DictionaryItem[];
}

export interface AIFeedbackInterface {
  type:
    | "CORRECTION"
    | "RECOMMENDATION"
    | "EXPLANATION"
    | "PRACTICE_TIP"
    | "GENERAL_FEEDBACK"
    | "OTHER";
  question?: string; // reference to question. If feedback is about a quiz, this will refer to the question of the quiz.
  turnIndex?: number; // reference to turn index. If feedback is about a conversation, this will refer to the turn index of the conversation.
  parts: {
    type: "WRONG" | "RIGHT" | "TIP" | "EXPLANATION" | "OTHER";
    text: string;
  }[];
}

export const aiFeedbackSchema = {
  type: "object",
  description:
    "Each feedback must be formatted as described. Feedbacks are created for the user's answers and behaviors for a material. Consists of feedback parts. For example, you can create multiple parts for an answer to a question in a QUIZ. You make a correction in one part and give a tip or explanation in the other part. Part text will be displayed to the user in md format.",
  properties: {
    type: {
      type: "string",
      description: "Feedback type",
      enum: [
        "CORRECTION",
        "RECOMMENDATION",
        "EXPLANATION",
        "PRACTICE_TIP",
        "GENERAL_FEEDBACK",
        "OTHER",
      ],
    },
    question: {
      type: "string",
      description:
        "Reference to question. If feedback is about a quiz, this will refer to the question of the quiz.",
    },
    turnIndex: {
      type: "number",
      description:
        "Reference to turn index. If feedback is about a conversation, this will refer to the turn index of the conversation.",
    },
    parts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["WRONG", "RIGHT", "TIP", "EXPLANATION", "OTHER"],
          },
          text: {
            type: "string",
            description:
              "Feedback text. Will be displayed to the user in md format.",
          },
        },
        required: ["type", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["type", "parts"],
  additionalProperties: false,
};

export function aiReviewResponseSchema(
  required: ("newMaterials" | "observations" | "weakPoints" | "strongPoints")[]
) {
  return {
    name: "AIGenerationResponse",
    type: "object",
    definitions: {
      ...materialDetailsDefs,
      Material: materialSchema,
      Edit: aiObservationEditSchema,
      PathLevel: pathLevelSchema,
      Feedback: aiFeedbackSchema,
    },
    properties: {
      newMaterials: {
        type: "array",
        description: "New materials to add to the user's learning",
        items: {
          $ref: "#/definitions/Material",
        },
      },
      newLevel: {
        oneOf: [{ $ref: "#/definitions/PathLevel" }, { type: "null" }],
      },
      observations: {
        $ref: "#/definitions/Edit",
        description: "Observations about the user's answers and behaviors.",
      },
      weakPoints: {
        $ref: "#/definitions/Edit",
        description: "Weak points of the user's learning",
      },
      strongPoints: {
        $ref: "#/definitions/Edit",
        description: "Strong points of the user's learning",
      },
      feedbacks: {
        type: "array",
        description: "Feedbacks for the user's answers and behaviors",
        items: { $ref: "#/definitions/Feedback" },
      },
    },
    additionalProperties: false,
    required: required || [],
  };
}

export const findDictItemFunctionSchema = {
  type: "object",
  description:
    "A function that finds a dictionary item based on a search term. The search term is a string.",
  properties: {
    search: { type: "string" },
  },
  required: ["search"],
  additionalProperties: false,
};

export interface AIConversationTurn {
  character: string;
  text: string;
  ssml: string;
}

export interface AIConversationTurnResponse {
  turn?: AIConversationTurn;
  nextTurn: string | null;
}

export const aiConversationTurnSchema = {
  type: "object",
  properties: {
    character: { type: "string" },
    text: {
      description: "User facing text",
      type: "string",
    },
    ssml: {
      description: "SSML for the text",
      type: "string",
    },
  },
  required: ["character", "text", "ssml"],
  additionalProperties: false,
};

export const aiConversationTurnResponseSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    turn: aiConversationTurnSchema,
    nextTurn: {
      type: ["string", "null"],
      description:
        "The next turn of the conversation. If null, conversation is finished. If not null, 'turn' is required.",
    },
  },
  required: ["nextTurn"],
  additionalProperties: false,
};

export interface ConversationTurn {
  character: string;
  text: string;
}

export class AIError extends Error {
  constructor(
    message: string,
    public eventId: string | null = null,
    public additional: any = null
  ) {
    super(message);
    this.name = "AIError";
  }

  toJSON() {
    return {
      message: this.message,
      eventId: this.eventId,
      additional: this.additional,
    };
  }
}

export class AIInvalidSchemaError extends AIError {
  constructor(
    message: string,
    public schema: any,
    public thisResponse: any,
    public validationErrors: ValidationError[],
    eventId: string | null = null
  ) {
    super(message, eventId);
    this.name = "AIInvalidSchemaError";
  }

  toJSON() {
    return {
      ...super.toJSON(),
      schema: this.schema,
      thisResponse: this.thisResponse,
      validationErrors: this.validationErrors,
    };
  }
}

export class AIRateLimitError extends AIError {
  constructor(
    message: string,
    public tryAgainAt: number,
    eventId: string | null = null
  ) {
    super(message, eventId);
    this.name = "AIRateLimitError";
  }

  toJSON() {
    return {
      ...super.toJSON(),
      tryAgainAt: this.tryAgainAt,
    };
  }
}
