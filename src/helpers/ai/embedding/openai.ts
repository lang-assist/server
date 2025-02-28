import { OpenAI } from "openai";
import { BrocaTypes } from "../../../types";
import { AIModel } from "../../../types/ctx";
import { EmbeddingGeneration } from "./base";

export class OpenAIEmbedding extends AIModel<EmbeddingGeneration> {
  constructor(
    public readonly name: string,
    public readonly apiKey: string,
    public readonly baseUrl: string,
    pricing: BrocaTypes.AI.Types.AIPricing
  ) {
    super("embedding", pricing);
  }

  async _generate(
    gen: EmbeddingGeneration
  ): Promise<BrocaTypes.AI.GenerationResponse<any>> {
    try {
      const res = await this.client.embeddings.create({
        model: this.name,
        input: gen.text,
      });

      return {
        res: Float32Array.from(res.data[0].embedding),
        usage: {
          input: res.usage.prompt_tokens,
          output: res.usage.total_tokens,
        },
      };
    } catch (e) {
      throw e;
    }
  }

  maxTries: number = 1;
  concurrency: number = 20;

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
}
