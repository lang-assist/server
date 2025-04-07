import { ObjectId } from "mongodb";
import { Anthropic, AnthropicError, RateLimitError } from "@anthropic-ai/sdk";
import { AIModel } from "../../../types/ctx";
import { ChatAIModel, ChatGeneration } from "./base";
import { PromptBuilder } from "../../../utils/prompter";
import { BrocaTypes, JsonL } from "../../../types";
import { AIError, AIRateLimitError } from "../../../utils/ai-types";
import { Chatgpt_event, Prompts } from "../../../models/_index";
import { Schema } from "jsonschema";

type AIUsage = BrocaTypes.AI.Types.AIUsage;

export class ClaudeModel extends ChatAIModel {

  maxTries: number = 1;
  concurrency: number = 10;
  constructor(
    public modelName: string,
    public apiKey: string,
    public pricing: JsonL.Types.AIPricing,
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

  async _generateStream(gen: ChatGeneration<any>, onDelta: (delta: string) => void): Promise<JsonL.GenerationResponse<boolean>> {
    const { context, messages } = gen.builder.buildForClaude();

    await Prompts.insertOne({
      genId: "claude",
      messages: messages,
      system: context,
      model: this.name,
    });


    const str = this.client.messages.stream({
      model: this.name,
      messages: messages,
      system: context,
      max_tokens: 8192,
      stream: true,
    });


    for await (const part of str) {
       if (part.type === "content_block_delta") {
          const delta = part.delta;
          if (delta.type === "text_delta") {
             onDelta(delta.text);
          }
       }
    }

    const f = await str.finalMessage();

    const usage = f.usage;

    return {
      res: true,
      usage: {
        input: usage.input_tokens,
        output: usage.output_tokens,
        cachedInput: usage.cache_read_input_tokens ?? 0,
        cacheWrite: usage.cache_creation_input_tokens ?? 0,  
      },
      error: undefined,
    };
  }
}
