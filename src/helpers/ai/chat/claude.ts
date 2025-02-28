import { ObjectId } from "mongodb";
import { Anthropic } from "@anthropic-ai/sdk";
import { AIModel } from "../../../types/ctx";
import { ChatGeneration } from "./base";
import { PromptBuilder } from "../../../utils/prompter";
import { BrocaTypes } from "../../../types";
import { AIError } from "../../../utils/ai-types";
import { Chatgpt_event, Prompts } from "../../../models/_index";
import { Schema } from "jsonschema";

type AIUsage = BrocaTypes.AI.Types.AIUsage;

export class ClaudeModel extends AIModel<ChatGeneration<any>> {
  async _generate(
    gen: ChatGeneration<any>
  ): Promise<BrocaTypes.AI.GenerationResponse<any>> {
    try {
      return await this.runChat(gen.builder, gen.schema);
    } catch (e) {
      throw e;
    }
  }
  maxTries: number = 1;
  concurrency: number = 10;
  constructor(
    public modelName: string,
    public apiKey: string,
    public pricing: BrocaTypes.AI.Types.AIPricing,
    public baseUrl?: string
  ) {
    super("chat", pricing);
    this.name = modelName;
  }

  name: string;

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
      schema: Schema;
    }
  ): Promise<{ res: any; usage: AIUsage }> {
    try {
      const { context, messages } = builder.buildForClaude();

      const prompt = await Prompts.insertOne({
        genId: "claude",
        messages: messages,
        system: context,
        model: this.name,
        schema: schema.schema as any,
        name: schema.name,
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
    } catch (e) {
      throw e;
    }
  }
}
