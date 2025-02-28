import { AzureOpenAIModel } from "./helpers/ai/chat/azure-chatgpt";
import { OpenAIModel } from "./helpers/ai/chat/chatgpt";
import { ClaudeModel } from "./helpers/ai/chat/claude";
import { OpenAIModelAssistant } from "./helpers/ai/chat/chatgpt-assistant";
import { VectorDBBase, VectorStore } from "./helpers/vectors";
import { MongoDBVectorDB } from "./helpers/vectors/dbs/mongodb";
import { RedisVectorDB } from "./helpers/vectors/dbs/redis";
import { AIModel } from "./types/ctx";
import { OpenAIEmbedding } from "./helpers/ai/embedding/openai";
import { FalImgGen } from "./helpers/ai/img/fal-img";
import { AzureTTS } from "./helpers/ai/voice/azure";
import { AzureSTT } from "./helpers/ai/voice/azure";
import { AzureOpenAIEmbedding } from "./helpers/ai/embedding/azure-openai";
import { VoiceStore } from "./helpers/vectors/stores/voice";
import { DictStore } from "./helpers/vectors/stores/dict";
import { DocStore } from "./helpers/vectors/stores/doc";
import {
  BaseMaterialTypeHelper,
  ConversationMaterialTypeHelper,
  QuizMaterialTypeHelper,
  StoryMaterialTypeHelper,
} from "./helpers/gen/materials/type-helpers";
import { AzureAssistant } from "./helpers/ai/chat/azure-assistant";
import { BrocaTypes } from "./types";
import { AIModels } from "./utils/constants";
import Decimal from "decimal.js";
import { GlobalAssistantManager } from "./helpers/assistant";

function millionTokenPrice(prices: {
  input: number;
  output: number;
  cachedInput?: number;
  cacheWrite?: number;
}): BrocaTypes.AI.Types.AIPricing {
  return {
    per: 1000,
    input: new Decimal(prices.input).div(1000).toNumber(),
    output: new Decimal(prices.output).div(1000).toNumber(),
    cachedInput: prices.cachedInput
      ? new Decimal(prices.cachedInput).div(1000).toNumber()
      : undefined,
    cacheWrite: prices.cacheWrite
      ? new Decimal(prices.cacheWrite).div(1000).toNumber()
      : undefined,
  };
}

const prices: {
  [key in keyof typeof AIModels.chat]: BrocaTypes.AI.Types.AIPricing;
} = {
  azure_gpt_4o: millionTokenPrice({
    input: 2.5,
    output: 10,
    cachedInput: 1.25,
  }),
  azure_gpt_4o_assistant: millionTokenPrice({
    input: 2.5,
    output: 10,
    cachedInput: 1.25,
  }),
  azure_o1: millionTokenPrice({
    input: 15,
    output: 60,
  }),
  azure_o1_mini: millionTokenPrice({
    input: 3,
    output: 12,
  }),
  claude_sonnet: millionTokenPrice({
    input: 3,
    output: 15,
    cachedInput: 0.3,
    cacheWrite: 3.75,
  }),
  claude_sonnet37: millionTokenPrice({
    input: 3,
    output: 15,
    cachedInput: 0.3,
    cacheWrite: 3.75,
  }),
  deepseek_chat: millionTokenPrice({
    input: 0.0001,
    output: 0.0004,
  }),
  deepseek_r1: millionTokenPrice({
    input: 0.00001,
    output: 0.00004,
  }),
  gpt_4o: millionTokenPrice({
    input: 0.25,
    output: 1,
  }),
  gpt_4o_assistant: millionTokenPrice({
    input: 0.25,
    output: 1,
  }),
  gpt_4o_mini_assistant: millionTokenPrice({
    input: 0.015,
    output: 0.06,
  }),
  o1: millionTokenPrice({
    input: 15,
    output: 60,
  }),
  o1_mini: millionTokenPrice({
    input: 3,
    output: 12,
  }),
};

export async function initServices() {
  BaseMaterialTypeHelper.addHelpers({
    CONVERSATION: new ConversationMaterialTypeHelper(),
    QUIZ: new QuizMaterialTypeHelper(),
    STORY: new StoryMaterialTypeHelper(),
  });
  await GlobalAssistantManager.init();
  await VectorDBBase.init([new MongoDBVectorDB(), new RedisVectorDB()]);
  await AIModel.init({
    azure_gpt_4o_assistant: new AzureAssistant(
      "gpt-4o",
      process.env.AZURE_AI_KEY!,
      prices.azure_gpt_4o_assistant,
      "https://broca-oai418024195739.cognitiveservices.azure.com/",
      "gpt-4o-assistant"
    ),
    gpt_4o_assistant: new OpenAIModelAssistant(
      "gpt-4o",
      prices.gpt_4o_assistant
    ),
    gpt_4o_mini_assistant: new OpenAIModelAssistant(
      "gpt-4o-mini",
      prices.gpt_4o_mini_assistant
    ),
    gpt_4o: new OpenAIModel(
      "gpt-4o",
      process.env.OPENAI_API_KEY!,
      prices.gpt_4o
    ),
    o1: new OpenAIModel("o1", process.env.OPENAI_API_KEY!, prices.o1),
    o1_mini: new OpenAIModel(
      "o1-mini",
      process.env.OPENAI_API_KEY!,
      prices.o1_mini
    ),
    azure_o1: new AzureOpenAIModel(
      "azure_o1",
      process.env.AZURE_AI_KEY!,
      prices.azure_o1,
      "https://broca-oai418024195739.cognitiveservices.azure.com/",
      "o1"
    ),
    azure_o1_mini: new AzureOpenAIModel(
      "azure_o1_mini",
      process.env.AZURE_AI_KEY!,
      prices.azure_o1_mini,
      "https://broca-oai418024195739.cognitiveservices.azure.com/",
      "o1-mini"
    ),
    azure_gpt_4o: new AzureOpenAIModel(
      "azure_gpt_4o",
      process.env.AZURE_AI_KEY!,
      prices.azure_gpt_4o,
      "https://broca-oai418024195739.cognitiveservices.azure.com/",
      "gpt-4o"
    ),
    claude_sonnet: new ClaudeModel(
      "claude-3-5-sonnet-20241022",
      process.env.ANTHROPIC_API_KEY!,
      prices.claude_sonnet
    ),
    claude_sonnet37: new ClaudeModel(
      "claude-3-7-sonnet-20250219",
      process.env.ANTHROPIC_API_KEY!,
      prices.claude_sonnet37
    ),
    deepseek_chat: new OpenAIModel(
      "deepseek-chat",
      process.env.DEEPSEEK_API_KEY!,
      prices.deepseek_chat
    ),
    deepseek_r1: new AzureOpenAIModel(
      "DeepSeek-R1",
      process.env.AZURE_AI_KEY!,
      prices.deepseek_r1,
      "https://broca-ai-srv.cognitiveservices.azure.com",
      "DeepSeek-R1"
    ),

    // Voice
    azure_tts: new AzureTTS("tts", {
      // 1M char 15 dollars
      per: 1000000,
      input: 0.0,
      output: 0.015,
    }),
    azure_stt: new AzureSTT("stt", {
      // 1 hour 1 dollars + 1 hour 0.3 dollars (pronunciation assessment)
      per: 3600000,
      input: 0.0,
      output: 1.3,
    }),

    // Image
    fal_flux_schnell: new FalImgGen("fal-ai/flux/schnell", 333),
    fal_sana: new FalImgGen("fal-ai/sana", 1000),

    // Embedding
    text_embedding_3_large: new OpenAIEmbedding(
      "text-embedding-3-large",
      process.env.OPENAI_API_KEY!,
      "https://broca-oai418024195739.cognitiveservices.azure.com/",
      {
        per: 1000,
        input: 0.0001,
        output: 0.00013,
      }
    ),
    text_embedding_3_small: new OpenAIEmbedding(
      "text-embedding-3-small",
      process.env.OPENAI_API_KEY!,
      "https://broca-oai418024195739.cognitiveservices.azure.com/",
      {
        per: 1000,
        input: 0,
        output: 0.00002,
      }
    ),
    text_embedding_3_large_azure: new AzureOpenAIEmbedding(
      "text-embedding-3-large-azure",
      process.env.AZURE_AI_KEY!,
      "https://broca-oai418024195739.cognitiveservices.azure.com/",
      "text-embedding-3-large-azure",
      {
        per: 1000,
        input: 0,
        output: 0.00013,
      }
    ),
    text_embedding_3_small_azure: new AzureOpenAIEmbedding(
      "text-embedding-3-small-azure",
      process.env.AZURE_AI_KEY!,
      "https://broca-oai418024195739.cognitiveservices.azure.com/",
      "text-embedding-3-small-azure",
      {
        per: 1000,
        input: 0,
        output: 0.00002,
      }
    ),
  });
  await VectorStore.init([new VoiceStore(), new DictStore(), new DocStore()]);
}
