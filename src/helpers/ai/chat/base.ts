import { Schema } from "jsonschema";
import { BrocaTypes } from "../../../types";
import { AIError } from "../../../utils/ai-types";
import { Generation, GenerationContext, GenType } from "../../../types/ctx";
import { PromptBuilder } from "../../../utils/prompter";
import { GlobalAssistantManager } from "../../assistant";
import { AIModels } from "../../../utils/constants";

export abstract class ChatGenerationContext extends GenerationContext {
  constructor(
    public type: BrocaTypes.AI.Types.MsgGenerationType,
    reason: string
  ) {
    super("idle", reason);
  }

  public rawResult: BrocaTypes.AI.GenResult<any> | null = null;

  public abstract get chatModel(): keyof typeof AIModels.chat;

  public abstract get threadId(): string | null;

  public abstract get assistant(): BrocaTypes.AI.AIAssistant | null;

  public abstract get language(): string;

  public abstract createAssistant(
    assistantContext: BrocaTypes.AI.AIAssistant
  ): Promise<void>;

  public abstract createThread(threadId: string): Promise<void>;
}

export abstract class ChatGenerationContextWithGlobalAssistant extends ChatGenerationContext {
  public toJSON(): any {
    return {
      rawResult: this.rawResult,
      assistant: this.assistant,
      reason: this.reason,
    };
  }

  public get threadId(): string | null {
    return null;
  }

  public get assistant(): BrocaTypes.AI.AIAssistant | null {
    return GlobalAssistantManager.getAssistant(this.type, this.chatModel);
  }

  public async createAssistant(
    assistantContext: BrocaTypes.AI.AIAssistant
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
  T extends BrocaTypes.AI.Types.MsgGenerationType
> extends Generation<BrocaTypes.AI.GenResult<T>> {
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

  public totalUsage: BrocaTypes.AI.Types.AIUsage = {
    input: 0,
    output: 0,
    cachedInput: 0,
    cacheWrite: 0,
  };

  public tries: number = 0;

  public addUsage(usage: BrocaTypes.AI.Types.AIUsage) {
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

  async generate(): Promise<BrocaTypes.AI.GenResult<T>> {
    const g = await super.generate();

    this.ctx.rawResult = g;

    return g;
  }
}
