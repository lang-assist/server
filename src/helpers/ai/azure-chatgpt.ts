import { AzureOpenAI } from "openai";

import { getBearerTokenProvider } from "@azure/identity";

import { AzureKeyCredential } from "@azure/core-auth";

import { AIGeneratedDocumentation, SupportedLocale } from "../../utils/types";
import { AIModel, AIUsage } from "./base";
import { ObjectId } from "mongodb";
import {
  Chatgpt_event,
  IJourney,
  IMaterial,
  IUserAnswer,
  Prompts,
} from "../../models/_index";
import { PromptBuilder } from "ai-prompter";
import { IUserPath } from "../../models/_index";
import { WithId } from "mongodb";
import {
  AIConversationTurn,
  aiConversationTurnResponseSchema,
  AIError,
  AIGenerationResponse,
  aiReviewResponseSchema,
  ParsedLinguisticUnitSet,
} from "../../utils/ai-types";

export class AzureOpenAIModel extends AIModel {
  constructor(
    public modelName: string,
    public apiKey: string,
    price: {
      input: number;
      output: number;
    },
    public baseUrl: string,
    public deployment: string
  ) {
    super({
      input: price.input,
      output: price.output,
      cachedInput: 0,
      cacheWrite: 0,
    });
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
    args: {
      journey_ID?: ObjectId;
      userPath_ID?: ObjectId;
      answer_ID?: ObjectId;
    }
  ): Promise<{ res: any; usage: AIUsage }> {
    const prompt = builder.build();

    Prompts.insertOne({
      messages: prompt,
      user_ID: args.userPath_ID,
      journey_ID: args.journey_ID,
      path_ID: args.userPath_ID,
      material_ID: args.answer_ID,
      purpose: "chat",
    });

    const res = await this.client.chat.completions.create({
      model: this.name,
      messages: prompt,
      response_format: {
        type: "json_schema",
        json_schema: schema,
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

      console.log("OpenAI Usage:", usage);

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

  async _generateMaterial(
    builder: PromptBuilder,
    args: {
      aiModel: string;
      language: SupportedLocale;
      userPath?: WithId<IUserPath>;
      journey?: WithId<IJourney>;
      answer?: WithId<IUserAnswer>;
    }
  ): Promise<{ res: AIGenerationResponse; usage: AIUsage }> {
    try {
      const resText = await this.runChat(
        builder,
        {
          name: "AIGenerationResponse",
          schema: aiReviewResponseSchema([]),
        },
        {
          journey_ID: args.journey?._id,
          userPath_ID: args.userPath?._id,
          answer_ID: args.answer?._id,
        }
      );

      return resText;
    } catch (e) {
      throw new AIError("Failed to generate material", null, e);
    }
  }

  async _generateConversationTurn(
    builder: PromptBuilder,
    material: WithId<IMaterial>
  ): Promise<{
    res: { turn?: AIConversationTurn; nextTurn: string | null };
    usage: AIUsage;
  }> {
    const res = await this.runChat(
      builder,
      {
        name: "AIConversationTurnResponse",
        schema: aiConversationTurnResponseSchema,
      },
      {
        journey_ID: material.journey_ID,
        userPath_ID: material.path_ID,
        answer_ID: material._id,
      }
    );

    return res;
  }

  async _prepareConversation(
    builder: PromptBuilder,
    material: WithId<IMaterial>
  ): Promise<{ material: WithId<IMaterial>; usage: AIUsage }> {
    return {
      material,
      usage: {
        input: 0,
        output: 0,
        cachedInput: 0,
        cacheWrite: 0,
      },
    };
  }

  async _resolveLinguisticUnits(
    builder: PromptBuilder
  ): Promise<{ res: ParsedLinguisticUnitSet; usage: AIUsage }> {
    throw new Error("Not implemented");
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

  async _storeItemPicture(picture: {
    prompt: string;
    id: string;
  }): Promise<void> {
    throw new Error("Not implemented");
  }

  async _generateDocumentation(
    builder: PromptBuilder
  ): Promise<{ res: AIGeneratedDocumentation; usage: AIUsage }> {
    throw new Error("Not implemented");
  }
}
