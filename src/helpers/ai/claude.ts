import {
  AIGeneratedDocumentation,
  aiGeneratedDocumentationSchema,
  LinguisticUnitSet,
  linguisticUnitSetSchema,
  SupportedLocale,
  VectorStores,
} from "../../utils/types";
import { AIModel, AIUsage } from "./base";
import { ObjectId } from "mongodb";
import {
  Chatgpt_event,
  IJourney,
  IMaterial,
  IUserAnswer,
  Prompts,
  Usage,
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
import { Anthropic } from "@anthropic-ai/sdk";

export class ClaudeModel extends AIModel {
  constructor(
    public modelName: string,
    public apiKey: string,
    public baseUrl?: string
  ) {
    super({
      cachedInput: 0.3,
      input: 3,
      output: 15,
      cacheWrite: 3.75,
    });
    this.name = modelName;
  }

  name: string;

  vectorStoreIds: {
    [key in VectorStores]: string;
  } = {
    item_pictures: "vs_xLOouipT7gcihQg3r3r2zmgy",
    voices: "vs_Tw1chqXDa9shGDhC8H4AlFE9",
  };

  _client?: Anthropic;

  get client() {
    if (!this._client) {
      this._client = new Anthropic({
        apiKey: this.apiKey,
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
    const { context, messages } = builder.buildForClaude();

    Prompts.insertOne({
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      context,
      user_ID: args.userPath_ID,
      journey_ID: args.journey_ID,
      path_ID: args.userPath_ID,
      material_ID: args.answer_ID,
      purpose: "chat",
    });

    const res = await this.client.messages.create({
      model: this.name,
      messages: messages,
      system: context,
      max_tokens: 8192,
      tools: [
        {
          input_schema: schema.schema as any,
          name: schema.name,
          cache_control: {
            type: "ephemeral",
          },
        },
      ],
      tool_choice: {
        type: "tool",
        name: schema.name,
      },
    });

    if (res.content.length === 0) {
      throw new AIError("Failed to generate response", null, res);
    }

    if (res.content[0].type === "tool_use") {
      const input = res.content[0].input as any;
      Chatgpt_event.insertOne({
        data: {
          model: this.name,
          res,
        },
      });
      const usage = res.usage;
      return {
        res: input,
        usage: {
          input: usage.input_tokens,
          output: usage.output_tokens,
          cachedInput: usage.cache_read_input_tokens ?? 0,
          cacheWrite: usage.cache_creation_input_tokens ?? 0,
        },
      };
    } else {
      throw new AIError("Failed to generate response", null, res);
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
    const res = await this.runChat(
      builder,
      {
        name: "LinguisticUnitSet",
        schema: linguisticUnitSetSchema,
      },
      {}
    );

    return res;
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
    const res = await this.runChat(
      builder,
      {
        name: "Documentation",
        schema: aiGeneratedDocumentationSchema,
      },
      {}
    );

    return res;
  }
}
