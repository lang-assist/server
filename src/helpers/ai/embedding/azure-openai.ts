import { AzureOpenAI } from "openai";
import { BrocaTypes } from "../../../types";
import { AIModel } from "../../../types/ctx";
import { EmbeddingGeneration } from "./base";

export class AzureOpenAIEmbedding extends AIModel<EmbeddingGeneration> {
  constructor(
    public readonly name: string,
    public readonly apiKey: string,
    public readonly baseUrl: string,
    public readonly deployment: string,
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
        dimensions: gen.dim,
        encoding_format: "float",
      });

      return {
        res: Float32Array.from(res.data[0].embedding),
        usage: {
          input: res.usage.prompt_tokens,
          output: res.usage.total_tokens,
        },
      };
    } catch (e) {
      console.error("AZURE ERROR", e);
      throw e;
    }
  }

  maxTries: number = 1;
  concurrency: number = 20;

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

  toString() {
    return `AzureOpenAIEmbedding: ${this.name} ${typeof this._client}`;
  }
}
