import { AzureOpenAI } from "openai";

import { ObjectId } from "mongodb";
import { Chatgpt_event, Prompts } from "../../../models/_index";
import { ChatAIModel, ChatGeneration } from "./base";
import { JsonL } from "../../../types";
import { AIError } from "../../../utils/ai-types";
import { AIModel } from "../../../types/ctx";
import { PromptBuilder } from "../../../utils/prompter";

type AIUsage = JsonL.Types.AIUsage;

export class AzureOpenAIModel extends ChatAIModel {
  

  maxTries: number = 1;
  concurrency: number = 10;

  constructor(
    public modelName: string,
    public apiKey: string,
    price: JsonL.Types.AIPricing,
    public baseUrl: string,
    public deployment: string,
    public apiVersion: string = "2024-08-01-preview"
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
        apiVersion: this.apiVersion,
      });
    }
    return this._client;
  }

  async _init(): Promise<void> {
    return Promise.resolve();
  }

  async _generateStream(gen: ChatGeneration<any>, onDelta: (delta: string) => void): Promise<JsonL.GenerationResponse<boolean>> {
      const prompt = gen.builder.build();
  
      await Prompts.insertOne({
        genId: gen.id,
        messages: prompt,
        model: this.name,
      });
  
  
      const stream = await this.client.chat.completions.create({
        model: this.name,
        messages: prompt,
        stream: true,
      });
  
  
      for await (const part of stream) {
  
        if (part.choices && part.choices.length > 0) {
          const c = part.choices[0];
  
          if (c.delta) {
            onDelta(c.delta.content!);
          }
          // TODO: Error handle
        }
  
        if (part.usage) {
          return {
            res: true,
            usage: {
              input: part.usage.prompt_tokens,
              output: part.usage.completion_tokens,
              cachedInput: part.usage.prompt_tokens_details?.cached_tokens || 0,
              cacheWrite: 0
            },
            error: undefined,
          };
        }
  
      }
  
      return {
        res: true,
        usage: {
          input: 0,
          output: 0,
          cachedInput: 0,
          cacheWrite: 0,
        },
        error: undefined,
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
}
