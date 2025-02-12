import { ObjectId, WithId } from "mongodb";
import {
  AIConversationTurn,
  aiConversationTurnResponseSchema,
  AIGenerationResponse,
  AIInvalidSchemaError,
  AIModels,
  AIObservationEdit,
  AIRateLimitError,
  aiReviewResponseSchema,
  AISpeechStory,
  ConversationTurn,
  MsgGenerationType,
  ParsedLinguisticUnitSet,
} from "../../utils/ai-types";
import {
  AiErrors,
  IJourney,
  IMaterial,
  IUser,
  IUserAnswer,
  IUserPath,
  IVoices,
  StoredFile,
  Voices,
} from "../../models/_index";
import {
  ConversationDetails,
  SupportedLocale,
  AIGeneratedDocumentation,
  SupportedLanguage,
  LinguisticUnitSet,
  aiGeneratedDocumentationSchema,
  linguisticUnitSetSchema,
} from "../../utils/types";
import { DbHelper } from "../db";
import { RedisClientType, SchemaFieldTypes, VectorAlgorithms } from "redis";
import { MessageBuilder, msg, PromptBuilder } from "ai-prompter";
import { Validator } from "jsonschema";
import { randomString } from "../../utils/random";
import { promises } from "readline";

// function hasNext(i: number, termSet: TermSet) {
//   return i < termSet.length;
// }

// function next(i: number, termSet: TermSet) {
//   return termSet[i];
// }

// function spaceRequired(term: Term) {
//   if (term.type === "PUNCTUATION") {
//     return false;
//   }
//   return true;
// }

// export function normalizeTerms(termSet: TermSet) {
//   let i = 0;

//   let normalized = [];

//   while (i < termSet.length) {
//     const term = termSet[i];
//     normalized.push(term.expr);
//     if (spaceRequired(term)) {
//       normalized.push(" ");
//     }
//     i++;
//   }

//   return normalized.join("");
// }

type QueueItem = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  gen: GenerationContext<any>;
  promise: (gen: GenerationContext<any>) => Promise<{
    res?: any;
    usage?: AIUsage;
    error?: Error;
  }>;
};

class AIModelQueue {
  constructor(
    public model: string,
    public maxTries: number,
    public concurrency: number
  ) {}

  private queue: QueueItem[] = [];
  private running: QueueItem[] = [];

  public add<T extends MsgGenerationType>(
    gen: GenerationContext<T>,
    promise: (gen: GenerationContext<T>) => Promise<{
      res?: any;
      usage?: AIUsage;
      error?: Error;
    }>
  ) {
    return new Promise<{
      res?: any;
      usage?: AIUsage;
      error?: Error;
    }>((resolve, reject) => {
      this.queue.push({
        gen,
        promise,
        resolve,
        reject,
      });
      this._run();
    });
  }

  private _insertFirst(item: QueueItem) {
    this.queue.unshift(item);
  }

  private _remove(item: QueueItem) {
    this.queue = this.queue.filter((i) => i.gen.id !== item.gen.id);
    this.running = this.running.filter((i) => i.gen.id !== item.gen.id);
    if (this.running.length === 0) {
      this._running = false;
    }
  }

  private _get(index: number) {
    return this.queue[index];
  }

  private _size() {
    return this.queue.length;
  }

  private _isEmpty() {
    return this.queue.length === 0;
  }

  private _isFull() {
    return this.running.length >= this.concurrency;
  }

  private _tryAgainAt: number = -1;

  private _handleError(item: QueueItem, e: any) {
    AiErrors.insertOne({
      model: this.model,
      errors: e,
      tries: item.gen.tries,
    });

    if (item.gen.tries >= this.maxTries) {
      item.reject(e);
      this._remove(item);
      return;
    }

    item.gen.tries++;

    // check error type

    if (e instanceof AIRateLimitError) {
      const tryAgainAt = e.tryAgainAt;
      this._tryAgainAt = tryAgainAt;
      this._remove(item);
      this._insertFirst(item);
      this._run();
      return;
    }

    if (e instanceof AIInvalidSchemaError) {
      const schema = e.schema;

      item.gen.builder.userMessage(
        `The schema is invalid. Please fix it and try again`
      );

      item.gen.builder.userMessage(
        `This message was: ${JSON.stringify(e.thisResponse)}`
      );

      item.gen.builder.userMessage(
        `Required schema is: ${JSON.stringify(schema)}`
      );
      this._remove(item);
      this._insertFirst(item);
      this._run();

      return;
    }

    item.reject(e);
    this._remove(item);
  }

  private _running = false;

  private async _run() {
    if (this._running) {
      return;
    }
    this._running = true;
    while (!this._isEmpty() && !this._isFull()) {
      if (this._tryAgainAt > 0) {
        if (Date.now() < this._tryAgainAt) {
          this._tryAgainAt = -1;
        } else {
          const timeToWait = this._tryAgainAt - Date.now();
          await new Promise((resolve) => setTimeout(resolve, timeToWait));
          this._tryAgainAt = -1;
        }
      }

      const item = this._get(0);
      if (!item) {
        continue;
      }
      this._remove(item);
      this.running.push(item);
      item
        .promise(item.gen)
        .then((res) => {
          if (res.usage) {
            item.gen.addUsage(res.usage);
          }
          if (res.error) {
            item.gen.addError(res.error);
            this._handleError(item, res.error);
            return;
          }

          const validator = new Validator();
          const result = validator.validate(res?.res, item.gen.schema);

          if (result.valid) {
            item.resolve(res);
            this._remove(item);
          } else {
            this._handleError(
              item,
              new AIInvalidSchemaError(
                "The response is not valid",
                item.gen.schema,
                res?.res,
                result.errors,
                null
              )
            );
          }
        })
        .catch((e) => {
          this._handleError(item, e);
        });
    }
  }
}

export type GenResult<T extends MsgGenerationType> = T extends "material"
  ? AIGenerationResponse
  : T extends "conversationTurn"
  ? ConversationTurn
  : T extends "linguisticUnits"
  ? LinguisticUnitSet
  : T extends "documentation"
  ? AIGeneratedDocumentation
  : T extends "speechStory"
  ? AISpeechStory
  : never;

export type AIUsage = {
  input: number; // tokens
  output: number; // tokens
  cachedInput?: number; // tokens
  cacheWrite?: number; // tokens
};

// export class Generation<
//   C extends GenerationContext<T, R>,
//   T extends MsgGenerationType,
//   R
// > {
//   constructor(public context: C, public type: T) {}

//   public id: string = randomString(32);
//   public tries: number = 0;

//   public rawResult?: GenResult<T>;

//   private _promise: Promise<R> | null = null;

//   public get promise(): Promise<R> {
//     if (!this._promise) {
//       throw new Error("Promise not set");
//     }
//     return this._promise;
//   }

//   private _builder: PromptBuilder | null = null;

//   public get builder(): PromptBuilder {
//     if (!this._builder) {
//       throw new Error("Builder not set");
//     }
//     return this._builder;
//   }

//   public set builder(builder: PromptBuilder) {
//     this._builder = builder;
//   }

//   usages: {
//     input: number;
//     output: number;
//     cachedInput?: number;
//     cacheWrite?: number;
//   }[] = [];

//   errors: Error[] = [];

//   public addUsage(usage: AIUsage) {
//     this.usages.push(usage);
//   }

//   public addError(error: Error) {
//     this.errors.push(error);
//   }

//   private _complete() {
//     // TODO: implement
//   }

//   private _completeError(error: Error) {
//     this.addError(error);
//     this._complete();
//   }

//   private _promises: Promise<any>[] = [];

//   private async _gen(): Promise<R> {
//     this._builder = new PromptBuilder();
//     await this.context.buildPrompt(this._builder);
//     this.context.readyStatus = "creating";
//     const res = await AIModel.generate(this);
//     this.rawResult = res.res as GenResult<T>;
//     this.context.prepare();

//     const result = await this.context.middleware(this);

//     this.context.readyStatus = "processing";

//     Promise.all(this._promises)
//       .then(() => {
//         this.context
//           .postProcess()
//           .then(() => {
//             this._complete();
//           })
//           .catch((e) => {
//             this._completeError(e);
//           });
//       })
//       .catch((e) => {
//         this._completeError(e);
//       });

//     return result;
//   }

//   public generate(): Promise<R> {
//     this._promise = this._gen();
//     return this._promise;
//   }

//   public async generateImg(
//     prompt: string,
//     resolve?: (buffer: Buffer) => void
//   ): Promise<ObjectId> {
//     const img = await StoredFile.insertOne({});

//     if (!img) {
//       throw new Error("Failed to insert image");
//     }

//     const promise = new Promise<Buffer>((resolve, reject) => {
//       // TODO: implement
//     });

//     this._promises.push(promise);

//     return img._id;
//   }

//   public generateStt(
//     audio: Buffer,
//     resolve?: (transcription: string, analyze: any) => void
//   ): Promise<any> {
//     const promise = new Promise<any>((resolve, reject) => {
//       // TODO: implement
//     });

//     this._promises.push(promise);

//     return promise;
//   }

//   public async generateTts(
//     ssml: string,
//     resolve?: (buffer: Buffer) => void
//   ): Promise<ObjectId> {
//     const audio = await StoredFile.insertOne({});

//     if (!audio) {
//       throw new Error("Failed to insert audio");
//     }

//     const promise = new Promise<Buffer>((resolve, reject) => {
//       // TODO: implement
//     });

//     this._promises.push(promise);

//     return audio._id;
//   }

//   public get schema(): any {
//     return Generation.schemas[this.type];
//   }

//   public static schemas: { [key in MsgGenerationType]: any } = {
//     material: aiReviewResponseSchema([]),
//     conversationTurn: aiConversationTurnResponseSchema,
//     documentation: aiGeneratedDocumentationSchema,
//     linguisticUnits: linguisticUnitSetSchema,

//     speechStory: {
//       // TODO: implement
//     },
//   };
// }

export abstract class GenerationContext<T extends MsgGenerationType> {
  constructor(args: {
    type: T;
    aiModel: AIModels;
    embeddingModel: string;
    imageGenModel: string;
    language: SupportedLanguage;
    mainRef: ObjectId;
    reason: string;
    whenComplete?: () => void;
  }) {
    this.type = args.type;
    this.aiModel = args.aiModel;
    this.embeddingModel = args.embeddingModel;
    this.imageGenModel = args.imageGenModel;
    this.language = args.language;
    this.mainRef = args.mainRef;
    this.reason = args.reason;
    this.whenComplete = args.whenComplete;
  }

  public type: T;

  public aiModel: AIModels;

  public embeddingModel: string;

  public imageGenModel: string;

  public language: SupportedLanguage;

  public mainRef: ObjectId;

  public reason: string;

  public builder: PromptBuilder = new PromptBuilder();

  public id = randomString(32);

  public tries = 0;

  public usages: AIUsage[] = [];

  public errors: Error[] = [];

  public whenComplete?: () => void;

  public addUsage(usage: AIUsage) {
    this.usages.push(usage);
  }

  public addError(error: Error) {
    this.errors.push(error);
  }

  public get schema(): any {
    return GenerationContext.schemas[this.type];
  }

  public static schemas: { [key in MsgGenerationType]: any } = {
    material: aiReviewResponseSchema([]),
    conversationTurn: aiConversationTurnResponseSchema,
    documentation: aiGeneratedDocumentationSchema,
    linguisticUnits: linguisticUnitSetSchema,

    speechStory: {
      // TODO: implement
    },
  };

  public complete() {}
}

export abstract class AIModel {
  constructor(
    public readonly _prices: {
      input: number; // MT
      output: number; // MT
      cachedInput: number; // MT
      cacheWrite?: number; // MT
    }
  ) {}

  private static queue: {
    [model: string]: AIModelQueue;
  } = {};

  static models: { [key: string]: AIModel } = {};

  static async init(models: { [key: string]: AIModel }) {
    this.models = models;
    for (const key in this.models) {
      this.queue[key] = new AIModelQueue(key, 1, 10);
    }
    await Promise.all(Object.values(this.models).map((model) => model._init()));
  }

  static updateArray(array: string[], updates: AIObservationEdit) {
    if (updates.add) {
      array.push(...updates.add);
    }
    if (updates.remove) {
      array.push(...updates.remove);
    }
    if (updates.replace) {
      for (const replace of updates.replace) {
        const index = array.findIndex((item) => item === replace[0]);
        if (index !== -1) {
          array[index] = replace[1];
        } else {
          array.push(replace[1]);
        }
      }
    }

    return array;
  }

  // static handleUsage(args: {
  //   usage: AIUsage;
  //   aiModel: string;
  //   purpose: AIRequestType;
  //   materialId?: ObjectId;
  //   userPathId?: ObjectId;
  //   journeyId?: ObjectId;
  //   userId?: ObjectId;
  // }) {
  //   const model = this.models[args.aiModel];
  //   const prices = model._prices;

  //   const usageRes = args.usage;

  //   const usages: {
  //     [key in keyof AIUsage]: Decimal;
  //   } = {
  //     input: new Decimal(usageRes.input).div(1000000),
  //     output: new Decimal(usageRes.output).div(1000000),
  //     cachedInput: new Decimal(usageRes.cachedInput).div(1000000),
  //     cacheWrite: usageRes.cacheWrite
  //       ? new Decimal(usageRes.cacheWrite).div(1000000)
  //       : undefined,
  //   };

  //   const costs: {
  //     [key in keyof typeof usages]: number;
  //   } = {
  //     input: new Decimal(prices.input).mul(usages.input).toNumber(),
  //     output: new Decimal(prices.output).mul(usages.output).toNumber(),
  //     cachedInput: new Decimal(prices.cachedInput)
  //       .mul(usages.cachedInput)
  //       .toNumber(),
  //     cacheWrite:
  //       prices.cacheWrite && usageRes.cacheWrite
  //         ? new Decimal(prices.cacheWrite).mul(usages.cacheWrite!).toNumber()
  //         : 0,
  //   };

  //   const total = Object.values(costs).reduce((acc, curr) => acc + curr, 0); // in dollars

  //   const withOneDollar = new Decimal(1).div(new Decimal(total)).floor();

  //   Usage.insertOne({
  //     usage: usageRes,
  //     costs,
  //     total,
  //     withOneDollar: withOneDollar.toNumber(),
  //     user_ID: args.userId,
  //     journey_ID: args.journeyId,
  //     path_ID: args.userPathId,
  //     material_ID: args.materialId,
  //     purpose: args.purpose,
  //   });
  // }

  static async generate<T extends MsgGenerationType>(
    gen: GenerationContext<T>
  ): Promise<AIGenerationResponse> {
    const queue = this.queue[gen.aiModel];
    const model = this.models[gen.aiModel];

    const aiResponse = await queue.add(gen, (g) => model._generate(g));

    if (aiResponse.usage) {
      gen.addUsage(aiResponse.usage);
    }

    if (aiResponse.error) {
      throw aiResponse.error;
    }

    if (!aiResponse.res) {
      throw new Error("No response from AI");
    }

    return aiResponse.res;
  }

  abstract _generate<T extends MsgGenerationType>(
    gen: GenerationContext<T>
  ): Promise<{
    raw?: any;
    res?: any;
    usage?: AIUsage;
    error?: Error;
  }>;

  // static async generateMaterial(
  //   builder: PromptBuilder,
  //   args: {
  //     aiModel: string;
  //     language: SupportedLocale;
  //     userPath?: WithId<IUserPath>;
  //     journey?: WithId<IJourney>;
  //     answer?: WithId<IUserAnswer> | null;
  //     requiredMaterials: {
  //       type: MaterialType;
  //       optional?: boolean;
  //       description?: string;
  //     }[];
  //   }
  // ): Promise<{
  //   materials: AIGeneratedMaterialResponse[];
  //   feedbacks: WithId<IAiFeedback>[];
  // }> {
  //   if (args.requiredMaterials.length > 0) {
  //     const req: string[] = [];

  //     if (args.requiredMaterials.length > 1) {
  //       req.push("Required materials are: \n");
  //     } else {
  //       req.push("Required material is: \n");
  //     }
  //     for (const material of args.requiredMaterials) {
  //       req.push(`${material.type}: ${material.description}`);
  //     }

  //     builder.assistantMessage(req.join("\n"), {
  //       extra: {
  //         tags: [PromptTags.MATERIAL],
  //       },
  //     });
  //   }

  //   const queue = this.queue[args.aiModel];
  //   const model = this.models[args.aiModel];

  //   const aiResponse = await queue.add(
  //     builder,
  //     (bldr) => {
  //       return model._generateMaterial(bldr, {
  //         userPath: args.userPath,
  //         journey: args.journey,
  //         language: args.language,
  //         answer: args.answer ?? undefined,
  //       });
  //     },
  //     "generateMaterial"
  //   );

  //   const pathUpdates: {
  //     "progress.observations"?: string[];
  //     "progress.strongPoints"?: string[];
  //     "progress.weakPoints"?: string[];
  //     [key: string]: any;
  //   } = {};

  //   this.handleUsage({
  //     usage: aiResponse.usage,
  //     aiModel: args.aiModel,
  //     purpose: "generateMaterial",
  //     materialId: args.answer?.material_ID,
  //     userPathId: args.userPath?._id,
  //     journeyId: args.journey?._id,
  //     userId: args.journey?.user_ID,
  //   });

  //   const res = aiResponse.res;

  //   let feedbacks: WithId<IAiFeedback>[] = [];

  //   if (args.journey && args.userPath) {
  //     if (res.newLevel) {
  //       Object.keys(res.newLevel).forEach((key) => {
  //         pathUpdates[`progress.level.${key}` as string] = res.newLevel![
  //           key as keyof PathLevel
  //         ] as any;
  //       });
  //     }

  //     if (res.observations) {
  //       const observations = this.updateArray(
  //         args.userPath.progress.observations,
  //         res.observations
  //       );

  //       pathUpdates["progress.observations"] = observations;
  //     }

  //     if (res.strongPoints) {
  //       const strongPoints = this.updateArray(
  //         args.userPath.progress.strongPoints,
  //         res.strongPoints
  //       );

  //       pathUpdates["progress.strongPoints"] = strongPoints;
  //     }

  //     if (res.weakPoints) {
  //       const weakPoints = this.updateArray(
  //         args.userPath.progress.weakPoints,
  //         res.weakPoints
  //       );

  //       pathUpdates["progress.weakPoints"] = weakPoints;
  //     }

  //     if (Object.keys(pathUpdates).length > 0) {
  //       await JourneyHelper.updateUserPath(
  //         args.userPath._id,
  //         pathUpdates as any
  //       );
  //     }

  //     if (res.feedbacks && res.feedbacks.length > 0) {
  //       feedbacks = await AiFeedback.insertMany(
  //         res.feedbacks.map((f) => ({
  //           material_ID: args.answer?.material_ID,
  //           user_ID: args.journey!.user_ID,
  //           feedback: f,
  //         }))
  //       ).catch((e) => {
  //         console.error(e);
  //         throw e;
  //       });
  //     }
  //   }

  //   return {
  //     materials: res.newMaterials ?? [],
  //     feedbacks,
  //   };
  // }

  // static async generateConversationTurn(
  //   builder: PromptBuilder,
  //   material: WithId<IMaterial>,
  //   journey: WithId<IJourney>,
  //   nextTurn: string | null
  // ): Promise<AIConversationTurnResponse> {
  //   if (nextTurn) {
  //     builder.userMessage(
  //       `Generate the next turn of the conversation: ${nextTurn}`,
  //       {
  //         extra: {
  //           tags: [PromptTags.TURNS],
  //         },
  //       }
  //     );
  //   }

  //   const queue = this.queue[journey.aiModel];
  //   const model = this.models[journey.aiModel];

  //   const aiResponse = await queue.add(
  //     builder,
  //     (bldr) => {
  //       return model._generateConversationTurn(bldr, material);
  //     },
  //     "generateConversationTurn"
  //   );

  //   this.handleUsage({
  //     usage: aiResponse.usage,
  //     aiModel: journey.aiModel,
  //     purpose: "generateConversationTurn",
  //     journeyId: journey._id,
  //     materialId: material._id,
  //   });

  //   const res = aiResponse.res;

  //   res.nextTurn = undefinedOrValue(res.nextTurn, null);

  //   return {
  //     turn: res.turn,
  //     nextTurn: res.nextTurn,
  //   };
  // }

  // static async prepareConversation(
  //   builder: PromptBuilder,
  //   material: WithId<IMaterial>,
  //   journey: WithId<IJourney>
  // ): Promise<{
  //   material: WithId<IMaterial>;
  // }> {
  //   return await this.models[journey.aiModel]._prepareConversation(
  //     builder,
  //     material
  //   );
  // }

  // static async resolveLinguisticUnits(
  //   text: string,
  //   journey: WithId<IJourney>
  // ): Promise<LinguisticUnitSet> {
  //   const model = this.models[journey.aiModel];
  //   const queue = this.queue[journey.aiModel];
  //   const builder = new PromptBuilder();

  //   linguisticUnitSetInstructions(builder);

  //   builder.userMessage(msg().add("Please parse it:").add(msg(text)), {
  //     extra: {
  //       tags: [PromptTags.MATERIAL],
  //     },
  //     cache: false,
  //   });

  //   const aiResponse = await queue.add(
  //     builder,
  //     (bldr) => {
  //       return model._resolveLinguisticUnits(bldr);
  //     },
  //     "resolveLinguisticUnits"
  //   );

  //   this.handleUsage({
  //     usage: aiResponse.usage,
  //     aiModel: journey.aiModel,
  //     purpose: "resolveLinguisticUnits",
  //     journeyId: journey._id,
  //   });

  //   return aiResponse.res.result;
  // }

  // static async generateDocumentation(
  //   builder: PromptBuilder,
  //   journey: WithId<IJourney>
  // ): Promise<AIGeneratedDocumentation> {
  //   const model = this.models[journey.aiModel];
  //   const queue = this.queue[journey.aiModel];

  //   const aiResponse = await queue.add(
  //     builder,
  //     (bldr) => {
  //       return model._generateDocumentation(bldr);
  //     },
  //     "generateDocumentation"
  //   );

  //   this.handleUsage({
  //     usage: aiResponse.usage,
  //     aiModel: journey.aiModel,
  //     purpose: "generateDocumentation",
  //     journeyId: journey._id,
  //   });

  //   return aiResponse.res;
  // }

  abstract readonly name: string;

  abstract _init(): Promise<void>;
}

export abstract class AIImageGenerator {
  abstract readonly name: string;

  static models: { [key: string]: AIImageGenerator } = {};

  static async init(models: { [key: string]: AIImageGenerator }) {
    this.models = models;
    for (const key in this.models) {
      await this.models[key]._init();
    }
  }

  abstract _init(): Promise<void>;

  abstract _generateItemPicture(prompt: string): Promise<{
    data: Buffer;
    contentType: string;
  }>;

  static async generateItemPicture(args: {
    prompt: string;
    model?: string;
  }): Promise<{
    data: Buffer;
    contentType: string;
  }> {
    return this.models[
      args.model ?? "fal-ai/flux/schnell"
    ]._generateItemPicture(args.prompt);
  }
}

export type EmbeddingDim = 1536 | 1024 | 512 | 256;

export abstract class AIEmbeddingGenerator {
  static defaultModel = "text-embedding-3-large";

  abstract readonly name: string;

  abstract _init(): Promise<void>;

  abstract _generateEmbedding(
    text: string,
    dim: EmbeddingDim
  ): Promise<Float32Array>;

  static models: { [key: string]: AIEmbeddingGenerator } = {};

  static async init(models: { [key: string]: AIEmbeddingGenerator }) {
    this.models = models;
    for (const key in this.models) {
      await this.models[key]._init();
    }
    await this.createDocIndexIfNotExists();
  }

  static async embedText(args: {
    text: string;
    dim: EmbeddingDim;
    model?: string;
  }): Promise<Float32Array> {
    return this.models[args.model ?? this.defaultModel]._generateEmbedding(
      args.text,
      args.dim
    );
  }

  static defaultDim: EmbeddingDim = 1536;

  static async deleteVoiceEmbeddings() {
    await Voices.updateMany(
      {
        embedding: { $exists: true },
      },
      // @ts-ignore
      { $unset: { embedding: "" } }
    );
  }

  static voiceInstructions(
    voice: WithId<IVoices>,
    options?: {
      withShortName?: boolean;
      withSecondaryLocales?: boolean;
      withPersonalities?: boolean;
      withStyles?: boolean;
      withTailoredScenarios?: boolean;
      overrideSingleLocale?: string;
    }
  ): MessageBuilder {
    const {
      withShortName = false,
      withSecondaryLocales = false,
      withPersonalities = false,
      withStyles = true,
      withTailoredScenarios = false,
      overrideSingleLocale,
    } = options ?? {};

    const message = msg();

    if (withShortName) {
      message.addKv("name", voice.shortName);
    }

    if (voice.gender === "Neutral") {
      message.addKv("gender", "unisex");
    } else {
      message.addKv("gender", voice.gender);
    }

    const locales = [];

    if (overrideSingleLocale) {
      locales.push(overrideSingleLocale);
    } else {
      locales.push(voice.locale.replace("_", "-"));
    }

    if (withSecondaryLocales) {
      locales.push(
        ...(voice.secondaryLocales ?? []).map((l) => l.replace("_", "-"))
      );
    }

    message.addKv("locales", locales.join(", "));

    if (
      withPersonalities &&
      voice.personalities &&
      voice.personalities.length > 0
    ) {
      message.addKv("personalities", voice.personalities.join(", "));
    }

    if (withStyles && voice.styles && voice.styles.length > 0) {
      message.addKv("styles", voice.styles.join(", "));
    }

    if (
      withTailoredScenarios &&
      voice.tailoredScenarios &&
      voice.tailoredScenarios.length > 0
    ) {
      message.addKv("scenarios", voice.tailoredScenarios.join(", "));
    }

    return message;
  }

  static async generateEmbeddingsForVoices() {
    const voices = await Voices.find(
      {
        embedding: {
          $exists: false,
        },
      },
      {
        limit: 1000,
      }
    );

    var i = 0;

    let promises: Promise<void>[] = [];

    for (const voice of voices) {
      promises.push(
        (async () => {
          const instructions = AIEmbeddingGenerator.voiceInstructions(voice, {
            withPersonalities: true,
            withStyles: true,
            withTailoredScenarios: true,
            withSecondaryLocales: true,
            withShortName: false,
          });

          const embedding = await AIEmbeddingGenerator.embedText({
            text: instructions.build(),
            model: this.defaultModel,
            dim: AIEmbeddingGenerator.defaultDim,
          });
          await Voices.findByIdAndUpdate(voice._id, {
            $set: {
              embedding: Array.from(embedding),
            },
          });
        })()
      );
      i++;
      if (i % 30 === 0) {
        await Promise.all(promises);
        promises = [];
      }
    }

    await Promise.all(promises);
  }

  static async deleteIndex() {
    const redisClient: RedisClientType = DbHelper.cacheHelper!.client;
    try {
      await redisClient.ft.dropIndex("idx:voices");
    } catch (e) {
      console.error(e);
    }
    try {
      const keys = await redisClient.keys("voices:*");
      await redisClient.del(keys);
    } catch (e) {
      console.error(e);
    }
  }

  static async cacheVoiceEmbeddings() {
    let skip = 0;

    const redisClient: RedisClientType = DbHelper.cacheHelper!.client;

    let hasIndex = false;

    try {
      await redisClient.ft.info("idx:voices");
      hasIndex = true;
    } catch (e) {
      console.error(e);
    }

    if (!hasIndex) {
      redisClient.ft.create(
        "idx:voices",
        {
          id: {
            type: SchemaFieldTypes.TEXT,
            NOINDEX: true,
          },
          vector: {
            type: SchemaFieldTypes.VECTOR,
            ALGORITHM: VectorAlgorithms.FLAT,
            TYPE: "FLOAT32",
            DIM: AIEmbeddingGenerator.defaultDim,
            DISTANCE_METRIC: "COSINE",
          },
          gender: {
            type: SchemaFieldTypes.TAG,
          },
        },
        {
          PREFIX: ["voice_vectors:", "idx:voices:", "voice_vectors:*"],
          ON: "HASH",
        }
      );
    }

    while (true) {
      const voices = await Voices.find(
        {
          embedding: { $exists: true },
        },
        { skip, limit: 10 }
      );

      if (voices.length === 0) {
        break;
      }

      skip += 10;

      for (const voice of voices) {
        const buffer = Buffer.from(Float32Array.from(voice.embedding!).buffer);

        await redisClient.hSet(`voice_vectors:${voice._id}`, {
          gender: voice.gender,
          vector: buffer,
          id: voice._id.toHexString(),
        });
      }
    }
  }

  static async searchVoice(args: {
    query: string;
    gender?: "Male" | "Female" | "Neutral";
    model?: string;
  }): Promise<(WithId<IVoices> & { distance: any; score: any })[]> {
    const redisClient: RedisClientType = DbHelper.cacheHelper!.client;

    const queryEmbedding = await AIEmbeddingGenerator.embedText({
      text: args.query,
      model: this.defaultModel,
      dim: AIEmbeddingGenerator.defaultDim,
    });

    const vectorBlob = Buffer.from(queryEmbedding.buffer);

    try {
      let q = "*";

      // if (args.gender && args.gender !== "Neutral") {
      //   q = `(@gender:{${args.gender}})`;
      // }

      const results = await redisClient.ft.search(
        "idx:voices",
        `${q}=>[KNN 10 @vector $BLOB as dist]`,
        {
          PARAMS: {
            BLOB: vectorBlob,
          },
          SORTBY: {
            BY: "dist",
            DIRECTION: "ASC",
          },
          DIALECT: 4,
        }
      );

      return await Promise.all(
        results.documents.map(async (doc) => {
          const voice = await Voices.findById(
            new ObjectId(doc.value.id as string)
          );

          return {
            ...voice!,
            distance: doc.value.dist,
            score: doc.value.score,
          };
        })
      );
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  static async selectVoice(conversationDetails: ConversationDetails): Promise<{
    [key: string]: string;
  }> {
    const characters = conversationDetails.characters;

    const voices = await Promise.all(
      characters
        .filter((c) => c.name !== "$user")
        .map(async (character) => {
          const q = msg();

          q.addKv("Character", character.description);
          q.addKv("Locale", character.locale);
          q.addKv("Scenario", conversationDetails.scenarioScaffold);

          const voice = await AIEmbeddingGenerator.searchVoice({
            query: q.build(),
            gender: character.gender,
          });

          if (voice.length === 0) {
            // find brute force
            const voice = await Voices.findOne({
              // locale eq character.locale or secondary locales includes character.locale
              $or: [
                { locale: character.locale },
                {
                  secondaryLocales: {
                    $in: [character.locale.replace("-", "_")],
                  },
                },
              ],
            });

            if (!voice) {
              throw new Error(`No voice found for character ${character.name}`);
            }

            return {
              [character.name]: voice._id.toHexString(),
            };
          }

          return {
            [character.name]: voice[0]._id.toHexString(),
          };
        })
    );

    return Object.assign({}, ...voices);
  }

  static async createDocIndexIfNotExists() {
    const redisClient: RedisClientType = DbHelper.cacheHelper!.client;

    try {
      await redisClient.ft.info("idx:docs");
      return;
    } catch (e) {
      console.error(e);
    }

    await redisClient.ft.create(
      "idx:docs",
      {
        id: {
          type: SchemaFieldTypes.TEXT,
          NOINDEX: true,
        },
        vector: {
          type: SchemaFieldTypes.VECTOR,
          ALGORITHM: VectorAlgorithms.FLAT,
          TYPE: "FLOAT32",
          DIM: AIEmbeddingGenerator.defaultDim,
          DISTANCE_METRIC: "COSINE",
        },
        summary: {
          type: SchemaFieldTypes.TEXT,
          NOINDEX: true,
        },
        aiModel: {
          type: SchemaFieldTypes.TAG,
          NOINDEX: false,
        },
        language: {
          type: SchemaFieldTypes.TAG,
          NOINDEX: false,
        },
      },
      {
        PREFIX: ["doc_vectors:", "idx:docs:", "doc_vectors:*"],
        ON: "HASH",
      }
    );
  }

  static async deleteDocIndex() {
    const redisClient: RedisClientType = DbHelper.cacheHelper!.client;
    await redisClient.ft.dropIndex("idx:docs");
  }

  static async cacheDocVector(input: {
    id: ObjectId;
    aiModel: string;
    language: string;
    summary: string;
  }) {
    const redisClient: RedisClientType = DbHelper.cacheHelper!.client;

    const embedding = await this.embedText({
      text: input.summary,
      dim: AIEmbeddingGenerator.defaultDim,
    });

    const buffer = Buffer.from(embedding.buffer);

    const aiModel = input.aiModel.replaceAll("-", "_");
    const language = input.language.replaceAll("-", "_");

    await redisClient.hSet(`doc_vectors:${input.id}`, {
      id: input.id.toHexString(),
      vector: buffer,
      aiModel: aiModel,
      language: language,
      summary: input.summary,
    });
  }

  static async searchDoc(args: {
    query: string;
    aiModel: string;
    language: string;
    limit: number;
    maxDistance: number;
  }): Promise<
    WithId<{
      summary: string;
    }>[]
  > {
    const redisClient: RedisClientType = DbHelper.cacheHelper!.client;

    const queryEmbedding = await this.embedText({
      text: args.query,
      dim: AIEmbeddingGenerator.defaultDim,
    });

    const vectorBlob = Buffer.from(queryEmbedding.buffer);

    const aiModel = args.aiModel.replaceAll("-", "_");
    const language = args.language.replaceAll("-", "_");

    let q = `(@aiModel:{${aiModel}} @language:{${language}})`;

    console.log(q);

    const results = await redisClient.ft.search(
      "idx:docs",
      `${q}=>[KNN 10 @vector $BLOB as dist]`,
      {
        PARAMS: {
          BLOB: vectorBlob,
        },
        SORTBY: {
          BY: "dist",
          DIRECTION: "ASC",
        },
        DIALECT: 4,
      }
    );

    const filtered = results.documents.filter((doc) => {
      if (doc.value && doc.value.dist) {
        console.log("DIST:", doc.value.dist, doc.value.id);
        return (doc.value.dist! as number) <= args.maxDistance;
      }
      return false;
    });

    return filtered.slice(0, args.limit).map((doc) => {
      return {
        _id: new ObjectId(doc.value.id as string),
        summary: doc.value.summary as string,
      };
    });
  }
}
