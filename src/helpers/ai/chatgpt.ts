import { ObjectId, WithId } from "mongodb";

import {
  AIConversationTurn,
  AIConversationTurnResponse,
  aiConversationTurnResponseSchema,
  AIError,
  AIGenerationResponse,
  AIInvalidSchemaError,
  AIRateLimitError,
  aiReviewResponseSchema,
} from "../../utils/ai-types";
import { AIEmbeddingGenerator, AIModel, EmbeddingDim, schemas } from "./base";
import { berberEnv } from "../../init";
import {
  Chatgpt_event,
  IJourney,
  IMaterial,
  IMeta,
  IUserPath,
  Material,
  Meta,
  Prompts,
  Usage,
} from "../../models/_index";
import OpenAI from "openai";
import { JourneyHelper } from "../journey";
import { Thread } from "openai/resources/beta/threads/threads";
import fs from "fs";
import { VectorStores } from "../../utils/types/common";
import { AssistantStream } from "openai/lib/AssistantStream";
import { PromptBuilder } from "ai-prompter";
import { AssistantStreamEvent } from "openai/resources/beta/assistants";
import { ValidationError } from "jsonschema";
import { instructions } from "../prompts";
import crypto from "crypto";
import { PromptFilters, SupportedLocale } from "../../utils/types";

interface InitialTemplateMeta {
  assistants: {
    [key in SupportedLocale]: {
      assistantId: string;
      hash: string;
    };
  };
}

export class OpenAIModel extends AIModel {
  constructor(public modelName: string) {
    super();
    this.name = modelName;
  }

  name: string;

  vectorStoreIds: {
    [key in VectorStores]: string;
  } = {
    item_pictures: "vs_xLOouipT7gcihQg3r3r2zmgy",
    voices: "vs_Tw1chqXDa9shGDhC8H4AlFE9",
  };

  apiKey: string = berberEnv.OPENAI_API_KEY;

  _client?: OpenAI;

  get client() {
    if (!this._client) {
      this._client = new OpenAI();
    }
    return this._client;
  }

  static mainInstructionHash: string | null = null;

  async _init(): Promise<void> {
    await this._createConversationAssistant();
    const hash = crypto
      .createHash("sha256")
      .update(
        instructions.main
          .copyWith({
            language: "us_US",
            userName: "John Doe",
          })
          .build()
      )
      .digest("hex");

    OpenAIModel.mainInstructionHash = hash;

    return Promise.resolve();
  }

  static conversationAssistantId: string | null = null;

  async prepareThread(args: {
    builder: PromptBuilder;
    aiModel: string;
    language: SupportedLocale;
    userPath?: WithId<IUserPath>;
    journey?: WithId<IJourney>;
    schema: {
      name: string;
      schema: any;
    };
  }): Promise<{
    threadId: string;
    assistantId: string;
    journey?: WithId<IJourney>;
    userPath?: WithId<IUserPath>;
  }> {
    let assistantId: string | null = null;
    let threadId: string | null = null;

    if (!args.journey) {
      assistantId = await this._getInitialTemplateAssistant(args.language);

      const { messages, context } = args.builder.buildForAssistant(
        PromptFilters.withoutMain
      );

      if (context) {
        messages.push({
          role: "assistant",
          content: context,
        });
      }

      const thread = await this.client.beta.threads.create({
        messages,
      });

      threadId = thread.id;
    } else {
      const journey = args.journey!;
      const userPath = args.userPath!;

      if (
        !journey.assistantId ||
        OpenAIModel.mainInstructionHash !== journey.assistantHash
      ) {
        const { context } = args.builder.buildForAssistant(
          PromptFilters.mainOnly
        );

        Prompts.insertOne({
          messages: [],
          context,
          user_ID: userPath.user_ID,
          journey_ID: journey._id,
          path_ID: userPath._id,
          purpose: "prepare-thread-for-journey",
        });

        const assistant = await this.client.beta.assistants.create({
          model: this.name,
          instructions: context,
          name: journey._id.toString(),
          response_format: {
            type: "json_schema",
            json_schema: args.schema,
          },
          metadata: {
            journeyId: journey._id.toString(),
          },
        });

        assistantId = assistant.id;

        const newJourney = await JourneyHelper.updateJourney(journey._id, {
          assistantId: assistant.id,
          assistantHash: OpenAIModel.mainInstructionHash!,
        });

        if (!newJourney) {
          throw new Error("Failed to update journey");
        }

        args.journey = newJourney;
      } else {
        assistantId = journey.assistantId;
      }

      if (!userPath.threadId) {
        const thread = await this.client.beta.threads.create({});

        const newUserPath = await JourneyHelper.updateUserPath(userPath._id, {
          threadId: thread.id,
        });

        if (!newUserPath) {
          throw new Error("Failed to update user path");
        }

        args.userPath = newUserPath;

        threadId = thread.id;
      } else {
        threadId = userPath.threadId;
      }
    }

    if (!threadId || !assistantId) {
      console.error(threadId, assistantId, args);
      throw new Error("Thread or assistant not found");
    }

    return {
      threadId,
      assistantId,
      journey: args.journey,
      userPath: args.userPath,
    };
  }

  async _generateMaterial(
    builder: PromptBuilder,
    args: {
      aiModel: string;
      language: SupportedLocale;
      userPath?: WithId<IUserPath>;
      journey?: WithId<IJourney>;
    }
  ): Promise<AIGenerationResponse> {
    const { threadId, assistantId, journey, userPath } =
      await this.prepareThread({
        builder: builder,
        aiModel: args.aiModel,
        language: args.language,
        schema: {
          name: "AIGenerationResponse",
          schema: aiReviewResponseSchema([]),
        },
        journey: args.journey,
        userPath: args.userPath,
      });

    args.journey = journey;
    args.userPath = userPath;

    try {
      const resText = await this.runThread({
        threadId,
        assistantId,
        userPath: userPath,
        journey: journey,
        builder: builder,
      });

      return resText;
    } catch (e) {
      throw new AIError("Failed to generate material", null, e);
    }
  }

  async runThread(args: {
    threadId: string;
    assistantId: string;
    userPath?: WithId<IUserPath>;
    journey?: WithId<IJourney>;
    builder: PromptBuilder;
  }): Promise<any> {
    try {
      let runId: string | null = null;
      let stepId: string | null = null;
      let msgId: string | null = null;

      const { messages, context } = args.builder.buildForAssistant(
        PromptFilters.withoutMain
      );

      const resText = await new Promise<any>(async (resolve, reject) => {
        try {
          Prompts.insertOne({
            messages,
            context,
            user_ID: args.userPath?.user_ID,
            journey_ID: args.journey?._id,
            path_ID: args.userPath?._id,
            purpose: "run-thread-for-material",
          });

          const run = this.client.beta.threads.runs.stream(args.threadId, {
            assistant_id: args.assistantId,
            additional_instructions: context,
            additional_messages: messages,
          });

          for await (const event of run) {
            switch (event.event) {
              case "thread.run.created":
                runId = event.data.id;
                break;
              case "thread.run.step.created":
                stepId = event.data.id;
                break;
              case "thread.message.created":
                msgId = event.data.id;
                break;
              case "thread.run.step.completed":
                Usage.insertOne({
                  user_ID: args.userPath?.user_ID,
                  journey_ID: args.journey?._id,
                  path_ID: args.userPath?._id,
                  runId,
                  stepId,
                  msgId,
                  usage: event.data.usage,
                });

                break;
              case "thread.run.failed":
                try {
                  const error = this.handleError(event);
                  reject(error);
                } catch (e) {
                  reject(e);
                }
                break;
              case "thread.message.completed":
                const content = event.data.content[0];
                if (content.type === "text") {
                  try {
                    const parsed = JSON.parse(content.text.value);
                    resolve(parsed);
                  } catch (e) {
                    console.error(content.text.value);
                    throw new Error("Failed to parse response");
                  }
                }
                break;
            }

            Chatgpt_event.insertOne({
              data: event,
            });
          }
        } catch (e) {
          console.error(e);
          reject(e);
        }
      });

      return resText;
    } catch (e) {
      throw e;
    }
  }

  async _generateConversationTurn(
    builder: PromptBuilder,
    material: WithId<IMaterial>
  ): Promise<{ turn?: AIConversationTurn; nextTurn: string | null }> {
    if (!material.threadId) {
      throw new Error("Thread not found");
    }

    const thread = await this.client.beta.threads.retrieve(material.threadId);

    if (!thread) {
      throw new Error("Thread not found");
    }

    try {
      const { messages, context } = builder.buildForAssistant(
        PromptFilters.turnsOnly
      );

      Prompts.insertOne({
        messages,
        context,
        user_ID: material.user_ID,
        journey_ID: material.journey_ID,
        path_ID: material.path_ID,
        material_ID: material._id,
        purpose: "generate-conversation-turn",
      });

      const run = this.client.beta.threads.runs.stream(thread.id, {
        assistant_id: OpenAIModel.conversationAssistantId!,
        additional_messages: messages,
        additional_instructions: context,
      });

      const res = await this.runConversationThread({
        journey_ID: material.journey_ID,
        path_ID: material.path_ID,
        user_ID: material.user_ID,
        thread,
        run,
      });

      return {
        turn: res.turn,
        nextTurn: res.nextTurn,
      };
    } catch (e) {
      throw new AIError("Failed to run conversation thread", null, e);
    }
  }
  async _prepareConversation(
    builder: PromptBuilder,
    material: WithId<IMaterial>
  ): Promise<{ material: WithId<IMaterial> }> {
    let thread: Thread | null = null;

    if (material.threadId) {
      thread = await this.client.beta.threads.retrieve(material.threadId);

      if (!thread) {
        throw new Error("Thread not found");
      }
    } else {
      const { messages, context } = builder.buildForAssistant(
        PromptFilters.withoutMain
      );

      let msgs = messages;

      if (context) {
        msgs = [
          {
            role: "assistant",
            content: context,
          },
          ...msgs,
        ];
      }

      Prompts.insertOne({
        messages: msgs,
        user_ID: material.user_ID,
        journey_ID: material.journey_ID,
        path_ID: material.path_ID,
        material_ID: material._id,
        purpose: "prepare-conversation",
      });

      thread = await this.client.beta.threads.create({
        messages: msgs,
      });

      const newMaterial = await Material.findByIdAndUpdate(material._id, {
        $set: {
          threadId: thread.id,
        },
      });

      if (!newMaterial) {
        throw new Error("Failed to update material");
      }

      material = newMaterial;

      return {
        material,
      };
    }

    return {
      material,
    };
  }

  /**
   * Example message includes like:
   *
   * (TPM): Limit 30000, Used 5330, Requested 24915.   Please try again in 489ms. Visit https://platform.openai.com/account/rate-limits to learn more.
   *
   * Try again expression can be "5s", "1m", "1.548ms" , "1,548ms"
   */
  parseRateLimitError(message: string): {
    limit: number;
    requested: number;
    tryAgainInMs: number;
    type: "TPM" | "RPM";
  } {
    // Rate limit tipini belirle (TPM veya RPM)
    const typeMatch = message.match(/\((TPM|RPM)\)/);
    const type = (typeMatch?.[1] || "TPM") as "TPM" | "RPM";

    // Limit ve kullanım sayılarını çıkart
    const numbers =
      message
        .match(/\d+(?:,\d+)?/g)
        ?.map((n) => parseInt(n.replace(",", ""))) || [];

    // Zaman ifadesini çıkart
    const timeMatch = message.match(/try again in ([\d,.]+\s*(?:ms|s|m))/i);
    let tryAgainMs = 0;

    if (timeMatch) {
      const [value, unit] = timeMatch[1]
        .toLowerCase()
        .trim()
        .match(/^([\d,.]+)\s*(ms|s|m)$/)!
        .slice(1);
      const numValue = parseFloat(value.replace(",", ""));

      switch (unit) {
        case "ms":
          tryAgainMs = numValue;
          break;
        case "s":
          tryAgainMs = numValue * 1000;
          break;
        case "m":
          tryAgainMs = numValue * 60 * 1000;
          break;
      }
    }

    return {
      type,
      limit: numbers[0] || 0,
      requested: numbers[2] || 0, // Used değerini atlayıp Requested değerini al
      tryAgainInMs: Math.round(tryAgainMs),
    };
  }

  handleError(event: AssistantStreamEvent.ThreadRunFailed): AIError {
    const lastError = event.data.last_error;

    if (lastError) {
      if (lastError.code === "rate_limit_exceeded") {
        const message = lastError.message;
        const parsed = this.parseRateLimitError(message);

        if (parsed.requested > parsed.limit) {
          return new AIError("This message is too long", event.data.id);
        }

        return new AIRateLimitError(
          lastError.code,
          parsed.tryAgainInMs + Date.now(),
          event.data.id
        );
      }
      return new AIError(lastError.message, event.data.id);
    }

    return new AIError(`Failed to run conversation thread`, event.data.id);
  }

  async runConversationThread(args: {
    thread: Thread;
    run: AssistantStream;
    user_ID: ObjectId;
    journey_ID: ObjectId;
    path_ID: ObjectId;
  }): Promise<AIConversationTurnResponse> {
    let runId: string | null = null;
    let stepId: string | null = null;
    let msgId: string | null = null;

    const resText = await new Promise<AIConversationTurnResponse>(
      async (resolve, reject) => {
        try {
          for await (const event of args.run) {
            switch (event.event) {
              case "thread.run.completed":
                break;
              case "thread.run.created":
                runId = event.data.id;
                break;
              case "thread.run.step.created":
                stepId = event.data.id;
                break;
              case "thread.message.created":
                msgId = event.data.id;
                break;
              case "thread.run.step.completed":
                Usage.insertOne({
                  user_ID: args.user_ID,
                  journey_ID: args.journey_ID,
                  path_ID: args.path_ID,
                  runId,
                  stepId,
                  msgId,
                  usage: event.data.usage,
                });

                break;
              case "thread.run.failed":
                try {
                  const error = this.handleError(event);
                  reject(error);
                } catch (e) {
                  reject(e);
                }
                break;
              case "thread.message.completed":
                const content = event.data.content[0];
                if (content.type === "text") {
                  try {
                    const parsed = JSON.parse(content.text.value);

                    resolve(parsed);
                  } catch (e) {
                    console.error(content.text.value);
                    throw new AIInvalidSchemaError(
                      "Failed to parse response",
                      schemas.generateConversationTurn,
                      content.text.value,
                      [new ValidationError("the response cannot be parsed")],
                      event.data.id
                    );
                  }
                }
                break;
            }

            Chatgpt_event.insertOne({
              data: event,
            });
          }
        } catch (e) {
          reject(e);
        }
      }
    );

    return resText;
  }

  async removeAssistant() {
    await Meta.deleteOne({
      name: `conversation-assistant-${this.name}`,
    });

    OpenAIModel.conversationAssistantId = null;
  }

  static _initialTemplateAssistants: {
    // language: assistantId
    [key: string]: {
      assistantId: string;
      hash: string;
    };
  } = {};

  async _getInitialTemplateAssistant(language: SupportedLocale) {
    if (OpenAIModel._initialTemplateAssistants[language]) {
      return OpenAIModel._initialTemplateAssistants[language].assistantId;
    }

    const meta: WithId<IMeta & InitialTemplateMeta> | null =
      (await Meta.findOne({
        name: `initial-template-assistant-${this.name}`,
      })) as WithId<IMeta & InitialTemplateMeta> | null;

    const instruction = instructions.main
      .copyWith({
        language,
        userName: "unknown",
      })
      .build();

    const hash = crypto.createHash("sha256").update(instruction).digest("hex");

    if (meta && meta.assistants[language].hash === hash) {
      return meta.assistants[language].assistantId;
    }

    Prompts.insertOne({
      messages: [],
      context: instruction,
      purpose: `create-initial-template-thread-${language}`,
    });

    const assistant = await this.client.beta.assistants.create({
      model: this.name,
      instructions: instruction,
      name: `initial-template-assistant-${this.name}-${language}`,
      response_format: {
        type: "json_schema",
        json_schema: {
          description: "The response of the initial template assistant",
          name: "AIGeneratedMaterialResponse",
          schema: aiReviewResponseSchema(["newMaterials"]),
        },
      },
    });

    OpenAIModel._initialTemplateAssistants[language] = {
      assistantId: assistant.id,
      hash,
    };

    await Meta.updateOne(
      {
        name: `initial-template-assistant-${this.name}`,
      },
      {
        $set: {
          [`assistants.${language}`]: {
            assistantId: assistant.id,
            hash,
          },
        },
      },
      {
        upsert: true,
      }
    );

    return assistant.id;
  }

  async _createConversationAssistant() {
    if (OpenAIModel.conversationAssistantId) {
      return;
    }

    const meta = await Meta.findOne({
      name: `conversation-assistant-${this.name}`,
    });

    const instruction = instructions.conversation
      .copyWith({
        language: "us_US",
        userName: "John Doe",
      })
      .build();

    const hash = crypto.createHash("sha256").update(instruction).digest("hex");

    if (meta && meta.hash === hash) {
      OpenAIModel.conversationAssistantId = meta.assistantId as string;
      return;
    }

    Prompts.insertOne({
      messages: [],
      context: instruction,
      purpose: "create-conversation-assistant",
    });

    const assistant = await this.client.beta.assistants.create({
      model: this.name,
      instructions: instruction,
      name: `conversation-assistant-${this.name}`,
      response_format: {
        type: "json_schema",
        json_schema: {
          description: "The response of the conversation assistant",
          name: "AIConversationTurnResponse",
          schema: aiConversationTurnResponseSchema,
        },
      },
    });

    OpenAIModel.conversationAssistantId = assistant.id;

    await Meta.updateOne(
      {
        name: `conversation-assistant-${this.name}`,
      },
      {
        $set: {
          assistantId: assistant.id,
          hash,
        },
      },
      {
        upsert: true,
      }
    );
  }

  async _createVoiceVectorStore(files: string[]) {
    const vectorStore = await this.client.beta.vectorStores.create({
      name: "voice-vector-store-2",
    });

    const uploaded: Set<string> = new Set();
    const filesToUpload = new Set(files);

    while (filesToUpload.size > 0) {
      // take 30 items
      const batch = Array.from(filesToUpload).slice(0, 10);

      await Promise.all(
        batch.map(async (file) => {
          const fileId = await this.client.files.create({
            purpose: "assistants",
            file: fs.createReadStream(file),
          });

          filesToUpload.delete(file);
          uploaded.add(fileId.id);
        })
      );
    }

    var counter = 0;

    for (const fileId of uploaded) {
      await this.client.beta.vectorStores.files.create(vectorStore.id, {
        file_id: fileId,
      });

      counter++;
      if (counter % 10 === 0) {
        console.warn(`Uploaded ${counter} of ${uploaded.size} files`);
      }
    }
  }

  async _storeItemPicture(picture: {
    prompt: string;
    id: string;
  }): Promise<void> {
    const vectorStore = await this.client.beta.vectorStores.retrieve(
      this.vectorStoreIds.item_pictures
    );

    const file = await this.client.files.create({
      purpose: "assistants",
      file: createStringFile(JSON.stringify(picture), picture.id, "image/png"),
    });

    await this.client.beta.vectorStores.files.create(vectorStore.id, {
      file_id: file.id,
    });
  }
}

function createStringFile(content: string, name: string, type: string) {
  return {
    size: content.length,
    type,
    text: async () => content,
    name,
    lastModified: Date.now(),
    slice: (start?: number, end?: number) =>
      createStringFile(content.slice(start, end), name, type),
  };
}

export class OpenAIEmbeddingGenerator extends AIEmbeddingGenerator {
  _init(): Promise<void> {
    return Promise.resolve();
  }

  apiKey: string = berberEnv.OPENAI_API_KEY;

  _client?: OpenAI;

  get client() {
    if (!this._client) {
      this._client = new OpenAI();
    }
    return this._client;
  }

  async _generateEmbedding(
    text: string,
    dim: EmbeddingDim
  ): Promise<Float32Array> {
    const embedding = await this.client.embeddings.create({
      input: text,
      model: this.modelName,
      dimensions: dim,
      encoding_format: "float",
    });

    return Float32Array.from(embedding.data[0].embedding);
  }

  constructor(public modelName: string) {
    super();
    this.name = modelName;
  }

  readonly name;
}
