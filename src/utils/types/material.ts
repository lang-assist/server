import { MaterialType } from "./common";
import {
  quizDetailsSchema,
  conversationDetailsSchema,
  materialDetailsRefs,
  storyDetailsSchema,
  questionItemSchema,
  quizQuestionsSchema,
} from "./material-details";
import { metadataSchema } from "./metadata";

export const materialDetailsDefs = {
  StoryDetails: _withType(storyDetailsSchema, "STORY"),
  QuizDetails: _withType(quizDetailsSchema, "QUIZ"),
  ConversationDetails: _withType(conversationDetailsSchema, "CONVERSATION"),
  QuestionItem: questionItemSchema,
  QuizQuestion: quizQuestionsSchema,
};

function _withType(schema: any, type: MaterialType) {
  schema.properties.type = {
    type: "string",
    const: type,
  };
  if (schema.required) {
    if (!schema.required.includes("type")) {
      schema.required.push("type");
    }
  } else {
    throw new Error("Type is required");
  }
  return schema;
}

export const materialSchema = {
  type: "object",
  properties: {
    metadata: metadataSchema,
    details: {
      oneOf: materialDetailsRefs,
    },
  },
  required: ["metadata", "details"],
  additionalProperties: false,
};
