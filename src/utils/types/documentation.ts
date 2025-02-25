import { ObjectId } from "mongodb";

export interface Explanation {
  type: "text" | "picture" | "audio";

  // for text
  text?: string;

  // for picture
  picturePrompt?: string; // AI generated prompt
  pictureId?: string; // t2i model generated id

  // for audio
  ssml?: string; // ssml for the speech synthesis
  audioId?: string; // audio id generated by the speech synthesis model

  // common
  ui?:
    | "tip"
    | "example"
    | "explanation"
    | "note"
    | "warning"
    | "error"
    | "right";
}

export const explanationSchema = {
  type: "object",
  name: "Explanation",
  oneOf: [
    {
      type: "object",
      properties: {
        type: { type: "string", const: "text" },
        text: { type: "string" },
        ui: {
          type: "string",
          enum: [
            "tip",
            "example",
            "explanation",
            "note",
            "warning",
            "error",
            "right",
          ],
        },
      },
      required: ["type", "text"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { type: "string", const: "picture" },
        picturePrompt: { type: "string" },
        ui: {
          type: "string",
          enum: [
            "tip",
            "example",
            "explanation",
            "note",
            "warning",
            "error",
            "right",
          ],
        },
      },
      required: ["type", "picturePrompt"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { type: "string", const: "audio" },
        ssml: { type: "string" },
        text: { type: "string" },
        ui: {
          type: "string",
          enum: [
            "tip",
            "example",
            "explanation",
            "note",
            "warning",
            "error",
            "right",
          ],
        },
      },
      required: ["type", "ssml", "text"],
      additionalProperties: false,
    },
  ],
};

export interface Documentation {
  title: string;
  description: string;
  includes: string[];
  explanations: Explanation[];
}

const documentationSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    id: { type: "string" },
    includes: { type: "array", items: { type: "string" } },
    explanations: {
      type: "array",
      items: { $ref: "#/definitions/Explanation" },
    },
  },
};

export interface AIGeneratedDocumentation {
  newDoc?: Documentation;
  existingDoc?: string;
}

export const aiGeneratedDocumentationSchema = {
  type: "object",
  definitions: {
    Documentation: documentationSchema,
    Explanation: explanationSchema,
  },
  properties: {
    newDoc: { $ref: "#/definitions/Documentation" },
    existingDoc: { type: "string" },
  },
  required: [],
  additionalProperties: false,
};
