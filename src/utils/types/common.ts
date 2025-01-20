export type MaterialType = "STORY" | "QUIZ" | "CONVERSATION";

export type MaterialTypeNames =
  | "StoryDetails"
  | "QuizDetails"
  | "ConversationDetails";

export const typesMapping: {
  [key in MaterialType]: MaterialTypeNames;
} = {
  STORY: "StoryDetails",
  QUIZ: "QuizDetails",
  CONVERSATION: "ConversationDetails",
};

export interface MaterialDetails {
  type: MaterialType;
}

export type VectorStores = "item_pictures" | "voices";

export type AIMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AIMessages = AIMessage[];
