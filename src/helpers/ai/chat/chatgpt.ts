import OpenAI from "openai";

import { ChatGeneration } from "./base";
import { Chatgpt_event } from "../../../models/_index";
import { BrocaTypes } from "../../../types";
import { AIError } from "../../../utils/ai-types";
import { AIModel } from "../../../types/ctx";
import { PromptBuilder } from "../../../utils/prompter";

export class OpenAIModel extends AIModel<ChatGeneration<any>> {
  maxTries: number = 1;
  concurrency: number = 10;

  async _generate(
    gen: ChatGeneration<any>
  ): Promise<BrocaTypes.AI.GenerationResponse<any>> {
    try {
      return await this.runChat(gen.builder, gen.schema);
    } catch (e) {
      throw e;
    }
  }

  constructor(
    public modelName: string,
    public apiKey: string,
    price: BrocaTypes.AI.Types.AIPricing,
    public baseUrl?: string
  ) {
    super("chat", price);
    this.name = modelName;
  }

  name: string;

  _client?: OpenAI;

  get client() {
    if (!this._client) {
      this._client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
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
    }
  ): Promise<{ res: any; usage: BrocaTypes.AI.Types.AIUsage }> {
    const prompt = builder.build();

    const res = await this.client.chat.completions.create({
      model: this.name,
      messages: prompt,
      response_format: {
        type: "json_schema",
        json_schema: schema.schema,
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
          cachedInput: 0,
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
