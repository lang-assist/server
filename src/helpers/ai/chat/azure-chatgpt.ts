import { AzureOpenAI } from "openai";

import { ObjectId } from "mongodb";
import { Chatgpt_event, Prompts } from "../../../models/_index";
import { ChatGeneration } from "./base";
import { BrocaTypes } from "../../../types";
import { AIError } from "../../../utils/ai-types";
import { AIModel } from "../../../types/ctx";
import { PromptBuilder } from "../../../utils/prompter";

type AIUsage = BrocaTypes.AI.Types.AIUsage;

export class AzureOpenAIModel extends AIModel<ChatGeneration<any>> {
  _generate(
    gen: ChatGeneration<any>
  ): Promise<BrocaTypes.AI.GenerationResponse<any>> {
    return this.runChat(gen.builder, gen.schema, gen.id);
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

  async runChat(
    builder: PromptBuilder,
    schema: {
      name: string;
      schema: any;
    },
    genId: string
  ): Promise<{ res: any; usage: AIUsage }> {
    const prompt = builder.build();

    Prompts.insertOne({
      genId,
      prompt,
    });

    const res = await this.client.chat.completions.create({
      model: this.name,
      messages: prompt,
      response_format: {
        type: "json_schema",
        json_schema: {
          schema: schema.schema,
          name: "response_schema",
        },
      },
    });

    if (res.choices.length === 0) {
      throw new AIError("Failed to generate response", null, res);
    }

    if (res.choices[0].message.refusal) {
      throw new AIError("Failed to generate response", null, res);
    }

    const content = res.choices[0].message.content;

    if (!content) {
      throw new AIError("Failed to generate response", null, res);
    }

    try {
      const parsed = JSON.parse(content);

      Chatgpt_event.insertOne({
        data: { res },
      });

      const usage = res.usage;

      if (!usage) {
        throw new AIError("Failed to get usage", null, res);
      }

      return {
        res: parsed,
        usage: {
          input: usage.prompt_tokens,
          output: usage.completion_tokens,
          cachedInput: usage.prompt_tokens_details?.cached_tokens || 0,
          cacheWrite: 0,
        },
      };
    } catch (e) {
      Chatgpt_event.insertOne({
        data: {
          res,
          error: e,
        },
      });
      throw new AIError("Failed to parse response", null, e);
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
}
