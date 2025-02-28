import { Schema } from "jsonschema";
import { AIError } from "../utils/ai-types";

export namespace BrocaTypes {
  export namespace Material {
    export type MaterialType = "STORY" | "QUIZ" | "CONVERSATION";

    export type MaterialDetailsNames =
      | "StoryDetails"
      | "QuizDetails"
      | "ConversationDetails";

    export const materialDetailsMapping: {
      [key in MaterialType]: MaterialDetailsNames;
    } = {
      STORY: "StoryDetails",
      QUIZ: "QuizDetails",
      CONVERSATION: "ConversationDetails",
    };

    export interface Material {
      details: MaterialDetails;
      metadata: MaterialMetadata;
    }

    export interface MaterialDetails {
      type: MaterialType;
    }

    export interface MaterialMetadata {
      id: string;
      title: string;
      description: string;
      estimatedDuration: number; // dakika cinsinden
      focusAreas: string[]; // simple-present, future-continuous, business, kitchen, etc.
      focusSkills: string[]; // writing, speaking, etc.
    }

    export const materialMetadataSchema: Schema = {
      type: "object",
      properties: {
        id: {
          description:
            "The id of the material. It will be used to match answers and materails. Can be like 'm1', 'm2', 'quiz1', 'conv2' etc.",
        },
        type: {
          type: "string",
          enum: ["STORY", "QUIZ", "CONVERSATION"],
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
      required: [
        "title",
        "description",
        "estimatedDuration",
        "focusAreas",
        "focusSkills",
        "id",
      ],
      additionalProperties: false,
    };

    export namespace Conversation {
      export interface ConversationCharacter {
        name: string;
        avatarPrompt: string;
        description: string;
        locale: string;
        gender: "Male" | "Female" | "Neutral";
      }

      export interface ConversationDetails
        extends BrocaTypes.Material.MaterialDetails {
        instructions: string;
        scenarioScaffold: string;
        characters: ConversationCharacter[];
        length: number;
        voices?: {
          [key: string]: {
            voiceId: string;
            instructions: string;
          }; // char name : voice id
        };
      }

      export const conversationDetailsSchema: Schema = {
        type: "object",
        properties: {
          instructions: {
            type: "string",
          },
          scenarioScaffold: {
            type: "string",
          },
          length: {
            type: "number",
          },
          characters: {
            type: "array",
            items: {
              oneOf: [
                {
                  type: "object",
                  properties: {
                    name: { const: "$user" },
                  },
                  required: ["name"],
                  additionalProperties: false,
                },
                {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                    },
                    locale: {
                      type: "string",
                    },
                    gender: {
                      type: "string",
                      enum: ["Male", "Female", "Neutral"],
                    },
                    description: {
                      type: "string",
                    },
                    avatarPrompt: {
                      type: "string",
                    },
                  },
                  required: [
                    "name",
                    "description",
                    "avatarPrompt",
                    "gender",
                    "locale",
                  ],
                  additionalProperties: false,
                },
              ],
            },
            minItems: 2,
            maxItems: 5,
          },
        },
        required: ["instructions", "characters", "scenarioScaffold", "length"],
        additionalProperties: false,
      };

      export interface ConversationTurn {
        character: string;
        text: string;
        ssml: string;
      }

      export interface ConversationTurnResponse {
        turn?: ConversationTurn;
        nextTurn: string | null;
      }

      const aiConversationTurnSchema: Schema = {
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
    }
    export namespace Quiz {
      export interface QuestionAnswer {
        answeredIn: number; // in seconds
        behaviors?: string[];
        answer: string | string[] | string[][] | boolean;
        transcription?: string;
      }

      export interface QuizAnswer {
        [questionId: string]: QuestionAnswer;
      }

      export interface QuizDetails extends MaterialDetails {
        questions: QuizQuestion[];
        preludes?: QuizPrelude[];
      }

      export const quizPreludeSchema: Schema = {
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
                    type: { type: "string", const: "TEXT" },
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

      export type QuizPreludeItemType = "TEXT" | "PICTURE" | "AUDIO";

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
        choices?: QuestionItem[]; // For multiple choice, choice, fill-choice text-input-choice
        secondaryChoices?: QuestionItem[]; // For matching, fill-choice
      }

      export interface QuestionItem {
        id: string;
        text: string;
        picturePrompt?: string;
        pictureId?: string;
      }

      export const questionItemSchema: Schema = {
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

      export const questionItemRef: Schema = {
        $ref: "#/definitions/QuestionItem",
      };

      export function quizQuestionSchema(
        type: QuizQuestionType,
        forMaterial: MaterialType
      ): Schema {
        const otherProperties: any = {};

        const requiredProperties = ["type", "question", "id"];

        if (
          type === "MULTIPLE_CHOICE" ||
          type === "CHOICE" ||
          type === "FILL_CHOICE" ||
          type === "MATCHING" ||
          type === "ORDERING"
        ) {
          otherProperties.choices = { type: "array", items: questionItemRef };
          requiredProperties.push("choices");

          if (type === "FILL_CHOICE" || type === "MATCHING") {
            otherProperties.secondaryChoices = {
              type: "array",
              items: questionItemRef,
            };
          }

          if (type === "MATCHING") {
            requiredProperties.push("secondaryChoices");
          }
        }

        if (forMaterial === "QUIZ") {
          otherProperties.preludeID = {
            type: "string",
          };
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
            ...otherProperties,
          },
          required: requiredProperties,
          additionalProperties: false,
        };
      }

      export const quizQuestionsSchema: Schema = {
        oneOf: [
          quizQuestionSchema("MULTIPLE_CHOICE", "QUIZ"),
          quizQuestionSchema("CHOICE", "QUIZ"),
          quizQuestionSchema("TRUE_FALSE", "QUIZ"),
          quizQuestionSchema("FILL_CHOICE", "QUIZ"),
          quizQuestionSchema("FILL_WRITE", "QUIZ"),
          quizQuestionSchema("MATCHING", "QUIZ"),
          quizQuestionSchema("ORDERING", "QUIZ"),
          quizQuestionSchema("TEXT_INPUT_WRITE", "QUIZ"),
          quizQuestionSchema("RECORD", "QUIZ"),
        ],
      };

      export const quizDetailsSchema: Schema = {
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

      export const quizDetailsDefs = {
        QuizQuestion: quizQuestionsSchema,
        QuestionItem: questionItemSchema,
      };
    }
    export namespace Story {
      export interface StoryPart {
        type: "PICTURE" | "AUDIO" | "QUESTION";
        picturePrompt?: string;
        ssml?: string;
        question?: Quiz.QuizQuestion;
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
        parts: StoryPart[];
      }

      export const storyDetailsSchema: Schema = {
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

      export const storyDetailsDefs = {
        QuizQuestion: Quiz.quizQuestionsSchema,
        QuestionItem: Quiz.questionItemSchema,
      };
    }

    // const materialDetailsDefs = {
    //   StoryDetails: _withType(Story.storyDetailsSchema, "STORY"),
    //   QuizDetails: _withType(Quiz.quizDetailsSchema, "QUIZ"),
    //   ConversationDetails: _withType(
    //     Conversation.conversationDetailsSchema,
    //     "CONVERSATION"
    //   ),
    //   QuestionItem: Quiz.questionItemSchema,
    //   QuizQuestion: Quiz.quizQuestionsSchema,
    // };

    // const materialDetailsRefs = [
    //   {
    //     $ref: "#/definitions/StoryDetails",
    //   },
    //   {
    //     $ref: "#/definitions/QuizDetails",
    //   },
    //   {
    //     $ref: "#/definitions/ConversationDetails",
    //   },
    // ];

    // function _withType(schema: any, type: MaterialType) {
    //   schema.properties.type = {
    //     type: "string",
    //     const: type,
    //   };
    //   if (schema.required) {
    //     if (!schema.required.includes("type")) {
    //       schema.required.push("type");
    //     }
    //   } else {
    //     throw new Error("Type is required");
    //   }
    //   return schema;
    // }

    // export const materialResponseSchema: Schema = {
    //   type: "object",
    //   definitions: {
    //     ...materialDetailsDefs,
    //     MaterialMetadata: materialMetadataSchema,
    //   },
    //   properties: {
    //     material: {
    //       oneOf: materialDetailsRefs,
    //     },
    //     metadata: {
    //       $ref: "#/definitions/MaterialMetadata",
    //     },
    //   },
    // };
  }

  export namespace Documentation {
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

    export const explanationSchema: Schema = {
      type: "object",
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

    const documentationSchema: Schema = {
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

    export const documentationResponseSchema: Schema = {
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
  }

  export namespace Dictionary {
    export interface DictionaryDefinition {
      id: string; // ai generated
      type: string; // ai generated, to group definitions
      text: string; // ai generated
      additional?: Documentation.Explanation[]; // ai generated
    }

    export interface DictionaryEntry {
      term: string; // internal
      language: string; // internal

      id: string; // ai generated id
      definitions: DictionaryDefinition[]; // ai generated definitions
    }

    const definitionSchema: Schema = {
      type: "object",
      properties: {
        id: { type: "string" },
        type: { type: "string" },
        text: { type: "string" },
        additional: { type: "array", items: Documentation.explanationSchema },
      },
      required: ["id", "type", "text"],
      additionalProperties: false,
    };

    export const dictionaryResponseSchema: Schema = {
      type: "object",
      definitions: {
        DictionaryDefinition: definitionSchema,
      },
      properties: {
        newEntry: {
          type: "object",
          properties: {
            id: { type: "string" },
            definitions: {
              type: "array",
              items: {
                $ref: "#/definitions/DictionaryDefinition",
              },
            },
          },
          required: ["id", "definitions"],
          additionalProperties: false,
        },
        newDefinition: {
          type: "object",
          properties: {
            entryId: { type: "string" },
            definitions: {
              type: "array",
              items: {
                $ref: "#/definitions/DictionaryDefinition",
              },
            },
          },
          required: ["entryId", "definitions"],
          additionalProperties: false,
        },
        existingDefinition: {
          type: "object",
          properties: {
            entryId: { type: "string" },
            definitionId: { type: "string" },
          },
          required: ["entryId", "definitionId"],
          additionalProperties: false,
        },
      },
      required: [],
      additionalProperties: false,
    };

    export type DictionaryResponse = {
      newEntry: {
        definitions: DictionaryDefinition[];
        entryId: string;
      };
      newDefinition: {
        entryId: string;
        definitions: DictionaryDefinition[];
      };
      existingDefinition: {
        entryId: string;
        definitionId: string;
      };
    };
  }

  export namespace Feedback {
    export interface Feedback {
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

    export const feedbackSchema: Schema = {
      type: "object",
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
        },
        turnIndex: {
          type: "number",
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

    export interface FeedbackResponse {
      feedbacks: Feedback[];
    }

    export const feedbackResponseSchema: Schema = {
      type: "object",
      properties: {
        feedbacks: {
          type: "array",
          items: feedbackSchema,
        },
      },
      required: ["feedbacks"],
      additionalProperties: false,
    };
  }

  export namespace LinguisticUnits {
    export interface UnitProps {
      key: string;
      value?: string;
      dict?: boolean;
      doc?: {
        title?: string;
        search?: string;
      };
    }

    export interface LinguisticUnit {
      text: string;
      props: UnitProps[];
      subUnits?: LinguisticUnit[];
    }

    export type LinguisticUnitSet = LinguisticUnit[];

    export type LinguisticUnitSetResponse = {
      result: LinguisticUnitSet;
    };

    export const unitPropsRef = {
      $ref: "#/definitions/UnitProps",
    };

    const unitPropsSchema: Schema = {
      type: "object",
      properties: {
        key: { type: "string", description: "Key of the property." },
        value: { type: "string", description: "Value of the property." },
        dict: {
          type: "boolean",
          description: "If the property is a dictionary item ref.",
        },
        doc: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Title of the documentation item.",
            },
            search: {
              type: "string",
              description: "Search of the documentation item.",
            },
          },
          description: "If the property is a documentation item ref.",
        },
      },
      additionalProperties: false,
    };

    const linguisticUnitSchema: Schema = {
      type: "object",
      properties: {
        text: { type: "string", description: "Value in string format." },
        props: {
          type: "array",
          items: unitPropsRef,
          description: "Properties of the unit.",
        },
        subUnits: {
          type: "array",
          items: { $ref: "#/definitions/LinguisticUnit" },
          description:
            "If the unit is a compound term, idiom, etc. it will have sub units.",
        },
      },
      required: ["text"],
      additionalProperties: false,
    };

    export const linguisticUnitRef: Schema = {
      $ref: "#/definitions/LinguisticUnit",
    };

    export const linguisticUnitDefinitions = {
      UnitProps: unitPropsSchema,
      LinguisticUnit: linguisticUnitSchema,
    };

    export const linguisticUnitResponseSchema: Schema = {
      type: "object",
      definitions: {
        ...linguisticUnitDefinitions,
      },
      properties: {
        result: {
          type: "array",
          items: linguisticUnitRef,
          description: "The result of the parsing.",
        },
      },
      required: ["result"],
      additionalProperties: false,
    };
  }

  export namespace Progress {
    export type PathType = "PROFESSION" | "GENERAL" | "INITIAL";

    export type PathLevel = {
      listening: number; // 0-100
      reading: number; // 0-100
      speaking: number; // 0-100
      writing: number; // 0-100
      grammar: number; // 0-100
      vocabulary: number; // 0-100
    };

    export type Path = {
      name: string;
      type: PathType;
      profession?: string;
      isMain: boolean;
      isActive: boolean;
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

    export interface AIProgressResponse {
      level: PathLevel | null;
      weakPoints: AIObservationEdit | null;
      strongPoints: AIObservationEdit | null;
      observations: AIObservationEdit | null;
    }

    export const aiProgressResponseSchema: Schema = {
      type: "object",
      definitions: {
        PathLevel: pathLevelSchema,
        AIObservationEdit: aiObservationEditSchema,
        Feedback: Feedback.feedbackSchema,
      },
      properties: {
        level: {
          oneOf: [
            {
              $ref: "#/definitions/PathLevel",
            },
            {
              type: "null",
            },
          ],
        },
        weakPoints: {
          oneOf: [
            { $ref: "#/definitions/AIObservationEdit" },
            { type: "null" },
          ],
        },
        strongPoints: {
          oneOf: [
            { $ref: "#/definitions/AIObservationEdit" },
            { type: "null" },
          ],
        },
        observations: {
          oneOf: [
            { $ref: "#/definitions/AIObservationEdit" },
            { type: "null" },
          ],
        },
      },
      required: ["level", "weakPoints", "strongPoints", "observations"],
      additionalProperties: false,
    };
  }

  export namespace AI {
    export type GenResult<T extends Types.MsgGenerationType> = T extends "quiz"
      ? Types.QuizGenerationResponse
      : T extends "conversation"
      ? Types.ConversationGenerationResponse
      : T extends "story"
      ? Types.StoryGenerationResponse
      : T extends "progress"
      ? Progress.AIProgressResponse
      : T extends "conversationTurn"
      ? Material.Conversation.ConversationTurnResponse
      : T extends "linguisticUnits"
      ? LinguisticUnits.LinguisticUnitSetResponse
      : T extends "documentation"
      ? Documentation.AIGeneratedDocumentation
      : T extends "feedback"
      ? Feedback.FeedbackResponse
      : T extends "dictionary"
      ? Dictionary.DictionaryResponse
      : never;
    export type GenerationResponse<T> = {
      res?: T;
      usage?: Types.AIUsage;
      error?: AIError;
    };

    export type MediaGenerationType = {
      buffer: Buffer;
      contentType: string;
    };

    export type TranscriptionGenerationType = {
      transcription: string;
      analyze: any;
    };

    export type MediaGenerationResponse =
      GenerationResponse<MediaGenerationType>;

    export type TranscriptionGenerationResponse =
      GenerationResponse<TranscriptionGenerationType>;

    export type ChatGenerationResponse<T extends Types.MsgGenerationType> =
      GenerationResponse<GenResult<T>>;
    export type AIAssistant = {
      id: string;
      version: number;
      schemaVersion: number;
    };

    export namespace Types {
      export type AIUsage = {
        input: number; // tokens
        output: number; // tokens
        cachedInput?: number; // tokens
        cacheWrite?: number; // tokens
      };

      export type AIPricing = {
        per: number; // per for the pricing. E.g. 1000000 for 1M tokens
        input: number; // tokens
        output: number; // tokens
        cachedInput?: number; // tokens
        cacheWrite?: number; // tokens
      };

      export type MsgGenerationType =
        | "quiz"
        | "conversation"
        | "story"
        | "progress"
        | "conversationTurn"
        | "linguisticUnits"
        | "documentation"
        | "feedback"
        | "dictionary";

      // export type MaterialGenerationResponse = {
      //   details: Material.MaterialDetails;
      //   metadata: Material.MaterialMetadata;
      // };

      export type QuizGenerationResponse = {
        details: Material.Quiz.QuizDetails;
        metadata: Material.MaterialMetadata;
      };

      export type ConversationGenerationResponse = {
        details: Material.Conversation.ConversationDetails;
        metadata: Material.MaterialMetadata;
      };

      export type StoryGenerationResponse = {
        details: Material.Story.StoryDetails;
        metadata: Material.MaterialMetadata;
      };

      export type ConversationTurnResponse =
        Material.Conversation.ConversationTurnResponse;
    }

    export namespace Schemas {
      export const schemaVersions: {
        [key in Types.MsgGenerationType]: number;
      } = {
        quiz: 1,
        conversation: 1,
        story: 1,
        progress: 1,
        conversationTurn: 1,
        linguisticUnits: 1,
        documentation: 1,
        feedback: 1,
        dictionary: 1,
      };

      export const schemes: {
        [key in Types.MsgGenerationType]: Schema;
      } = {
        quiz: {
          type: "object",
          definitions: Material.Quiz.quizDetailsDefs,
          properties: {
            details: Material.Quiz.quizDetailsSchema,
            metadata: Material.materialMetadataSchema,
          },
          required: ["details", "metadata"],
          additionalProperties: false,
        },
        conversation: {
          type: "object",
          properties: {
            details: Material.Conversation.conversationDetailsSchema,
            metadata: Material.materialMetadataSchema,
          },
          required: ["details", "metadata"],
          additionalProperties: false,
        },
        story: {
          type: "object",
          definitions: Material.Story.storyDetailsDefs,
          properties: {
            details: Material.Story.storyDetailsSchema,
            metadata: Material.materialMetadataSchema,
          },
          required: ["details", "metadata"],
          additionalProperties: false,
        },
        progress: Progress.aiProgressResponseSchema,
        conversationTurn:
          Material.Conversation.aiConversationTurnResponseSchema,
        linguisticUnits: LinguisticUnits.linguisticUnitResponseSchema,
        documentation: Documentation.documentationResponseSchema,
        feedback: Feedback.feedbackResponseSchema,
        dictionary: Dictionary.dictionaryResponseSchema,
      };

      export const progressResponseSchema: Schema =
        Progress.aiProgressResponseSchema;

      export const conversationTurnSchema: Schema =
        Material.Conversation.aiConversationTurnResponseSchema;

      export const linguisticUnitResponseSchema: Schema =
        LinguisticUnits.linguisticUnitResponseSchema;

      export const documentationResponseSchema: Schema =
        Documentation.documentationResponseSchema;

      export const feedbackResponseSchema: Schema =
        Feedback.feedbackResponseSchema;

      export const dictionaryResponseSchema: Schema =
        Dictionary.dictionaryResponseSchema;
    }
  }
}
