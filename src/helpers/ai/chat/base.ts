import { Schema } from "jsonschema";
import { BrocaTypes, JsonL } from "../../../types";
import { AIError } from "../../../utils/ai-types";
import {
  AIModel,
  Generation,
  GenerationContext,
  GenType,
} from "../../../types/ctx";
import { PromptBuilder } from "../../../utils/prompter";
import { GlobalAssistantManager } from "../../assistant";
import { AIModels } from "../../../utils/constants";
import { log } from "../../log";

export abstract class ChatAIModel extends AIModel<ChatGeneration<any>> {
  abstract _generateStream(
    gen: ChatGeneration<any>,
    onDelta: (delta: string) => void
  ): Promise<JsonL.GenerationResponse<boolean>>;

  async _generate(
    gen: ChatGeneration<any>,
    args: any[]
  ): Promise<JsonL.GenerationResponse<boolean>> {
    if (!args[0] || typeof args[0] !== "function") {
      throw new Error("onMessage is required for chat generation");
    }

    const onMessage = args[0] as (message: JsonL.MessageJsonLs<any>) => void;

    let processed = "";
    let unprocessed = "";

    const jsonlRegex = /^\s*{.*}\s*$/;

    const res = await this._generateStream(gen, (d) => {
      if (!d) {
        return;
      }

      unprocessed += d;

      const lines = unprocessed
        .split("\n")
        .map((e) => e.trim())
        .filter((e) => {
          return e.startsWith("{") && e.endsWith("}") && jsonlRegex.test(e);
        });

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);

          if (parsed && parsed.type && parsed.payload) {
            onMessage(parsed);
            processed += `\n${line}`;
            unprocessed = unprocessed.replace(line, "");
          }
        } catch (e) {
          //console.error(e);
        }
      }
    });

    if (unprocessed.trim().length > 0) {
      console.error("Unprocessed Message", unprocessed);
    }

    return res;
  }
}

export abstract class ChatGenerationContext extends GenerationContext {
  constructor(public type: JsonL.MessageGenerationType, reason: string) {
    super("idle", reason);
  }

  public rawResults: JsonL.MessageJsonLs<any>[] = [];

  public abstract get chatModel(): keyof typeof AIModels.chat;

  public abstract get threadId(): string | null;

  public abstract get assistant(): JsonL.AIAssistant | null;

  public abstract get language(): string;

  public abstract createAssistant(
    assistantContext: JsonL.AIAssistant
  ): Promise<void>;

  public abstract createThread(threadId: string): Promise<void>;
}

export abstract class ChatGenerationContextWithGlobalAssistant extends ChatGenerationContext {
  public toJSON(): any {
    return {
      rawResults: this.rawResults,
      assistant: this.assistant,
      reason: this.reason,
    };
  }

  public get threadId(): string | null {
    return null;
  }

  public get assistant(): JsonL.AIAssistant | null {
    return GlobalAssistantManager.getAssistant(this.type, this.chatModel);
  }

  public async createAssistant(
    assistantContext: JsonL.AIAssistant
  ): Promise<void> {
    await GlobalAssistantManager.createAssistant({
      assistantId: assistantContext.id,
      schemaVersion: assistantContext.schemaVersion,
      model: this.chatModel,
      instructionVersion: assistantContext.version,
      type: this.type,
    });
  }

  public createThread(threadId: string): Promise<void> {
    return Promise.resolve();
  }
}

export class ChatGeneration<
  T extends JsonL.MessageGenerationType
> extends Generation<JsonL.GenerationResponse<boolean>> {
  constructor(
    public type: T,
    public builder: PromptBuilder,
    public ctx: ChatGenerationContext
  ) {
    super(ctx, {
      reason: type,
    });
  }

  get genType(): GenType {
    return "chat";
  }

  public get schema(): {
    schema: Schema;
    name: string;
    version: number;
  } {
    return {
      schema: BrocaTypes.AI.Schemas.schemes[this.type],
      name: this.type,
      version: BrocaTypes.AI.Schemas.schemaVersions[this.type],
    };
  }

  public totalUsage: JsonL.Types.AIUsage = {
    input: 0,
    output: 0,
    cachedInput: 0,
    cacheWrite: 0,
  };

  public tries: number = 0;

  public addUsage(usage: JsonL.Types.AIUsage) {
    this.totalUsage.input += usage.input;
    this.totalUsage.output += usage.output;
    if (usage.cachedInput && this.totalUsage.cachedInput) {
      this.totalUsage.cachedInput += usage.cachedInput;
    }
    if (usage.cacheWrite && this.totalUsage.cacheWrite) {
      this.totalUsage.cacheWrite += usage.cacheWrite;
    }
  }

  public errors: AIError[] = [];

  public addError(error: AIError) {
    this.errors.push(error);
  }

  async generate(
    onMessage: (message: JsonL.MessageJsonLs<T>) => void
  ): Promise<JsonL.GenerationResponse<boolean>> {
    const g = await super.generate(onMessage);

    return g;
  }
}
