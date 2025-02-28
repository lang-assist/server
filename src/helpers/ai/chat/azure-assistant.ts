import { AzureOpenAI } from "openai";
import { AssistantStreamEvent } from "openai/resources/beta/assistants";
import { AIModel } from "../../../types/ctx";
import { ChatGeneration } from "./base";
import { BrocaTypes } from "../../../types";
import { berberEnv } from "../../../init";
import { Chatgpt_event, Prompts } from "../../../models/_index";
import { AIRateLimitError } from "../../../utils/ai-types";
import { AIError } from "../../../utils/ai-types";

export class AzureAssistant extends AIModel<ChatGeneration<any>> {
  async _generate(
    gen: ChatGeneration<any>
  ): Promise<BrocaTypes.AI.GenerationResponse<any>> {
    try {
      return await this.runThread(gen);
    } catch (e) {
      throw e;
    }
  }

  maxTries: number = 1;
  concurrency: number = 10;

  constructor(
    public modelName: string,
    public apiKey: string,
    price: BrocaTypes.AI.Types.AIPricing,
    public baseUrl: string,
    public deployment: string
  ) {
    super("chat", price);
    this.name = modelName;
  }

  name: string;

  _client?: AzureOpenAI;

  get client() {
    if (!this._client) {
      this._client = new AzureOpenAI({
        apiKey: this.apiKey,
        deployment: this.deployment,
        endpoint: this.baseUrl,
        apiVersion: "2024-08-01-preview",
      });
    }
    return this._client;
  }

  async _init(): Promise<void> {
    return Promise.resolve();
  }

  static conversationAssistantId: string | null = null;

  async runThread(
    gen: ChatGeneration<any>
  ): Promise<{ res: any; usage: BrocaTypes.AI.Types.AIUsage }> {
    try {
      let assistant: BrocaTypes.AI.AIAssistant | null = gen.ctx.assistant;
      let threadId: string | null = gen.ctx.threadId;

      const { messages, assistantContext, threadContext } =
        gen.builder.buildForAssistant();

      if (!assistantContext) {
        throw new Error("Assistant context not found");
      }

      if (assistant && assistant.version !== assistantContext.version) {
        const newAssistant = {
          id: assistant.id,
          ...assistantContext,
          schemaVersion: gen.schema.version,
        };

        await gen.ctx.createAssistant(newAssistant);

        await this.client.beta.assistants.update(assistant.id, {
          instructions: assistantContext.text,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: gen.type,
              schema: gen.schema.schema as any,
            },
          },
        });

        assistant = newAssistant;
      } else if (!assistant) {
        const nAssistant = await this.client.beta.assistants.create({
          model: this.name,
          instructions: assistantContext.text,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: gen.type,
              schema: gen.schema.schema as any,
            },
          },
        });

        assistant = {
          id: nAssistant.id,
          ...assistantContext,
          schemaVersion: gen.schema.version,
        };

        await gen.ctx.createAssistant(assistant);
      }

      const assistantId = assistant!.id;

      if (!threadId) {
        const thread = await this.client.beta.threads.create({});

        threadId = thread.id;

        await gen.ctx.createThread(threadId);
      }

      let usage: BrocaTypes.AI.Types.AIUsage | null = null;
      let parsed: any | null = null;

      Prompts.insertOne({
        genId: gen.id,
        prompt: messages,
        assistantId,
        threadId,
        additional_instructions: threadContext,
        instructions: assistantContext.text,
      });

      const resText = await new Promise<any>(async (resolve, reject) => {
        try {
          const run = this.client.beta.threads.runs.stream(threadId, {
            assistant_id: assistantId,
            additional_instructions: threadContext,
            additional_messages: messages,
          });

          for await (const event of run) {
            switch (event.event) {
              case "thread.run.created":
                break;
              case "thread.run.step.created":
                break;
              case "thread.message.created":
                break;
              case "thread.run.step.completed":
                const us = event.data.usage;

                if (us) {
                  usage = {
                    input: us.prompt_tokens,
                    output: us.completion_tokens,
                    cachedInput: 0,
                    cacheWrite: 0,
                  };
                } else {
                  usage = {
                    input: 0,
                    output: 0,
                    cachedInput: 0,
                    cacheWrite: 0,
                  };
                  console.warn("No usage found");
                }

                if (parsed) {
                  resolve({
                    res: parsed,
                    usage: usage ?? {
                      input: 0,
                      output: 0,
                      cachedInput: 0,
                      cacheWrite: 0,
                    },
                  });
                }

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
                    parsed = JSON.parse(content.text.value);

                    if (usage) {
                      resolve({
                        res: parsed,
                        usage: usage ?? {
                          input: 0,
                          output: 0,
                          cachedInput: 0,
                          cacheWrite: 0,
                        },
                      });
                    }
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
}
