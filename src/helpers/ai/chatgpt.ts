import { ObjectId, WithId } from "mongodb";

import {
  AIConversationTurn,
  AIConversationTurnResponse,
  aiConversationTurnResponseSchema,
  aiConversationTurnSchema,
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
  IConversationTurn,
  IJourney,
  IMaterial,
  IUserPath,
  Material,
  Meta,
  Usage,
  Voices,
} from "../../models/_index";
import OpenAI from "openai";
import { JourneyHelper } from "../journey";
import { Thread } from "openai/resources/beta/threads/threads";
import fs from "fs";
import { getConversationMainInstruction, getMainInstruction } from "../prompts";
import { AIMessages, VectorStores } from "../../utils/types/common";
import {
  AssistantStream,
  AssistantStreamEvents,
} from "openai/lib/AssistantStream";
import { PromptBuilder } from "../../utils/prompt-builder";
import { AssistantStreamEvent } from "openai/resources/beta/assistants";
import { ValidationError } from "jsonschema";

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

  async prepareThread(args: {
    userPath: WithId<IUserPath>;
    journey: WithId<IJourney>;
    schema: {
      name: string;
      schema: any;
    };
    instructions: string;
  }): Promise<{
    thread: Thread;
    journey: WithId<IJourney>;
    userPath: WithId<IUserPath>;
  }> {
    if (!args.journey.assistantId) {
      const assistant = await this.client.beta.assistants.create({
        model: this.name,
        instructions: args.instructions,
        name: args.journey._id.toString(),
        response_format: {
          type: "json_schema",
          json_schema: args.schema,
        },
        metadata: {
          journeyId: args.journey._id.toString(),
        },
      });

      const newJourney = await JourneyHelper.updateJourney(args.journey._id, {
        assistantId: assistant.id,
      });

      if (!newJourney) {
        throw new Error("Failed to update journey");
      }

      args.journey = newJourney;
    }

    if (!args.userPath.threadId) {
      const thread = await this.client.beta.threads.create({});

      const newUserPath = await JourneyHelper.updateUserPath(
        args.userPath._id,
        {
          threadId: thread.id,
        }
      );

      if (!newUserPath) {
        throw new Error("Failed to update user path");
      }

      args.userPath = newUserPath;
    }

    return {
      thread: await this.client.beta.threads.retrieve(args.userPath.threadId!),
      journey: args.journey,
      userPath: args.userPath,
    };
  }

  async _generateMaterial(
    builder: PromptBuilder,
    args: {
      userPath: WithId<IUserPath>;
      journey: WithId<IJourney>;
    }
  ): Promise<AIGenerationResponse> {
    const { thread, journey, userPath } = await this.prepareThread({
      schema: {
        name: "AIGenerationResponse",
        schema: aiReviewResponseSchema([]),
      },
      instructions: getMainInstruction(args.journey.to),
      journey: args.journey,
      userPath: args.userPath,
    });

    args.journey = journey;
    args.userPath = userPath;

    const { messages, additionalContext } = builder.buildForAssistant();

    try {
      const resText = await this.runThread({
        thread,
        userPath: userPath,
        journey: journey,
        additionalContext: additionalContext,
        additionalMessages: messages,
      });

      return resText;
    } catch (e) {
      throw new AIError("Failed to generate material", null, e);
    }
  }

  async runThread(args: {
    thread: Thread;
    userPath: WithId<IUserPath>;
    journey: WithId<IJourney>;
    additionalContext?: string;
    additionalMessages: {
      role: "user" | "assistant";
      content: string;
    }[];
  }): Promise<any> {
    console.log(
      "RUN STARTED GPT",
      args.additionalMessages,
      args.additionalContext
    );

    try {
      let runId: string | null = null;
      let stepId: string | null = null;
      let msgId: string | null = null;

      const resText = await new Promise<any>(async (resolve, reject) => {
        try {
          const run = this.client.beta.threads.runs.stream(args.thread.id, {
            assistant_id: args.journey.assistantId!,
            additional_instructions: args.additionalContext,
            additional_messages: args.additionalMessages,
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
                  user_ID: args.userPath.user_ID,
                  journey_ID: args.journey._id,
                  path_ID: args.userPath._id,
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
          reject(e);
        }
      });

      return resText;
    } catch (e) {
      throw e;
    }
  }

  apiKey: string = berberEnv.OPENAI_API_KEY;

  _client?: OpenAI;

  get client() {
    if (!this._client) {
      this._client = new OpenAI();
    }
    return this._client;
  }

  async _init(): Promise<void> {
    await this.client.beta.assistants.list();
    await this._createConversationAssistant();
    return Promise.resolve();
  }

  static conversationAssistantId: string | null = null;

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
      const { messages, additionalContext } = builder.buildForAssistant();

      const run = this.client.beta.threads.runs.stream(thread.id, {
        assistant_id: OpenAIModel.conversationAssistantId!,
        additional_messages: messages,
        additional_instructions: additionalContext,
      });

      const res = await this.runConversationThread({
        journey_ID: material.journey_ID,
        path_ID: material.path_ID,
        user_ID: material.user_ID,
        thread,
        run,
      });

      console.log("RUN COMPLETED", res);

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
      const { messages, additionalContext } = builder.buildForAssistant();

      if (additionalContext) {
        messages.push({
          role: "assistant",
          content: additionalContext,
        });
      }

      thread = await this.client.beta.threads.create({
        messages,
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
        console.log(parsed);
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

  async _createConversationAssistant() {
    if (OpenAIModel.conversationAssistantId) {
      return;
    }

    const meta = await Meta.findOne({
      name: `conversation-assistant-${this.name}`,
    });

    if (meta) {
      OpenAIModel.conversationAssistantId = meta.assistantId as string;
      return;
    }

    const assistant = await this.client.beta.assistants.create({
      model: this.name,
      instructions: getConversationMainInstruction(),
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

    console.log(assistant);

    OpenAIModel.conversationAssistantId = assistant.id;

    await Meta.updateOne(
      {
        name: `conversation-assistant-${this.name}`,
      },
      {
        $set: {
          assistantId: assistant.id,
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

      console.log(
        `Uploaded ${uploaded.size} files, ${filesToUpload.size} left`
      );
    }

    var counter = 0;

    for (const fileId of uploaded) {
      await this.client.beta.vectorStores.files.create(vectorStore.id, {
        file_id: fileId,
      });

      counter++;
      if (counter % 10 === 0) {
        console.log(`Uploaded ${counter} of ${uploaded.size} files`);
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

    console.log(`Stored item picture ${picture.id}`);
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
