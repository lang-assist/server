import { ObjectId, WithId } from "mongodb";
import {
  AIConversationTurn,
  AIConversationTurnResponse,
  aiConversationTurnResponseSchema,
  AIGeneratedMaterialResponse,
  AIGenerationResponse,
  AIInvalidSchemaError,
  AIObservationEdit,
  AIRateLimitError,
  aiReviewResponseSchema,
} from "../../utils/ai-types";
import {
  AiErrors,
  AiFeedback,
  IConversationTurn,
  IJourney,
  IMaterial,
  IUser,
  IUserAnswer,
  IUserPath,
  IVoices,
  UserPath,
  Voices,
} from "../../models/_index";
import { JourneyHelper } from "../journey";
import {
  PathLevel,
  MaterialType,
  ConversationDetails,
  PromptTags,
  SupportedLocale,
} from "../../utils/types";
import { DbHelper } from "../db";
import { RedisClientType, SchemaFieldTypes, VectorAlgorithms } from "redis";
import { MessageBuilder, msg, PromptBuilder } from "ai-prompter";
import { Validator } from "jsonschema";
import { randomString } from "../../utils/random";

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

type AIRequestType =
  | "generateMaterial"
  | "generateConversationTurn"
  | "embedding";

export const schemas: { [key in AIRequestType]: any } = {
  generateMaterial: aiReviewResponseSchema([]),
  generateConversationTurn: aiConversationTurnResponseSchema,
  embedding: {
    type: "array",
    items: {
      type: "number",
    },
  },
};

type QueueItem = {
  reqId: string;
  builder: PromptBuilder;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  promise: (builder: PromptBuilder) => Promise<any>;
  tries: number;
  type: AIRequestType;
};

class AIModelQueue {
  constructor(
    public model: string,
    public maxTries: number,
    public concurrency: number
  ) {}

  private queue: QueueItem[] = [];
  private running: QueueItem[] = [];

  public add<T>(
    builder: PromptBuilder,
    promise: (builder: PromptBuilder) => Promise<T>,
    type: AIRequestType
  ) {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        builder,
        promise,
        resolve,
        reject,
        tries: 0,
        type,
        reqId: randomString(32),
      });
      this._run();
    });
  }

  private _insertFirst(item: QueueItem) {
    this.queue.unshift(item);
  }

  private _remove(item: QueueItem) {
    this.queue = this.queue.filter((i) => i.reqId !== item.reqId);
    this.running = this.running.filter((i) => i.reqId !== item.reqId);
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
      tries: item.tries,
    });

    if (item.tries >= this.maxTries) {
      item.reject(e);
      this._remove(item);
      return;
    }

    item.tries++;

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
      item.builder.userMessage(
        `The schema is invalid. Please fix it and try again`
      );
      item.builder.userMessage(
        `This message was: ${JSON.stringify(e.thisResponse)}`
      );
      item.builder.userMessage(`Required schema is: ${JSON.stringify(schema)}`);
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
        .promise(item.builder)
        .then((res) => {
          const validator = new Validator();
          const result = validator.validate(res, schemas[item.type]);
          if (result.valid) {
            item.resolve(res);
            this._remove(item);
          } else {
            this._handleError(
              item,
              new AIInvalidSchemaError(
                "The response is not valid",
                schemas[item.type],
                res,
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

export abstract class AIModel {
  constructor() {}

  private static queue: {
    [model: string]: AIModelQueue;
  } = {};

  static models: { [key: string]: AIModel } = {};

  static async init(models: { [key: string]: AIModel }) {
    this.models = models;
    for (const key in this.models) {
      this.queue[key] = new AIModelQueue(key, 3, 10);
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

  static async generateMaterial(
    builder: PromptBuilder,
    args: {
      aiModel: string;
      language: SupportedLocale;
      userPath?: WithId<IUserPath>;
      journey?: WithId<IJourney>;
      answer?: WithId<IUserAnswer> | null;
      requiredMaterials: {
        type: MaterialType;
        optional?: boolean;
        description?: string;
      }[];
    }
  ): Promise<AIGeneratedMaterialResponse[]> {
    if (args.requiredMaterials.length > 0) {
      const req: string[] = [];

      if (args.requiredMaterials.length > 1) {
        req.push("Required materials are: \n");
      } else {
        req.push("Required material is: \n");
      }
      for (const material of args.requiredMaterials) {
        req.push(`${material.type}: ${material.description}`);
      }

      builder.assistantMessage(req.join("\n"), {
        extra: {
          tags: [PromptTags.MATERIAL],
        },
      });
    }

    const queue = this.queue[args.aiModel];
    const model = this.models[args.aiModel];

    const res = await queue.add(
      builder,
      (bldr) => {
        return model._generateMaterial(bldr, {
          userPath: args.userPath,
          journey: args.journey,
          language: args.language,
        });
      },
      "generateMaterial"
    );

    const pathUpdates: {
      "progress.observations"?: string[];
      "progress.strongPoints"?: string[];
      "progress.weakPoints"?: string[];
      [key: string]: any;
    } = {};

    if (args.journey && args.userPath) {
      if (res.newLevel) {
        Object.keys(res.newLevel).forEach((key) => {
          pathUpdates[`progress.level.${key}` as string] = res.newLevel![
            key as keyof PathLevel
          ] as any;
        });
      }

      if (res.observations) {
        const observations = this.updateArray(
          args.userPath.progress.observations,
          res.observations
        );

        pathUpdates["progress.observations"] = observations;
      }

      if (res.strongPoints) {
        const strongPoints = this.updateArray(
          args.userPath.progress.strongPoints,
          res.strongPoints
        );

        pathUpdates["progress.strongPoints"] = strongPoints;
      }

      if (res.weakPoints) {
        const weakPoints = this.updateArray(
          args.userPath.progress.weakPoints,
          res.weakPoints
        );

        pathUpdates["progress.weakPoints"] = weakPoints;
      }

      if (Object.keys(pathUpdates).length > 0) {
        await JourneyHelper.updateUserPath(
          args.userPath._id,
          pathUpdates as any
        );
      }

      if (res.feedbacks && res.feedbacks.length > 0) {
        AiFeedback.insertMany(
          res.feedbacks.map((f) => ({
            material_ID: args.answer?.material_ID,
            user_ID: args.journey!.user_ID,
            feedback: f,
          }))
        ).catch((e) => {
          console.error(e);
        });
      }
    }

    return res.newMaterials ?? [];
  }

  static considerAsNull = ["null", "undefined", "NULL", null, undefined];

  static async generateConversationTurn(
    builder: PromptBuilder,
    material: WithId<IMaterial>,
    journey: WithId<IJourney>,
    nextTurn: string | null,
    userTurn?: WithId<IConversationTurn>
  ): Promise<AIConversationTurnResponse> {
    if (userTurn) {
      builder.userMessage(userTurn.text, {
        extra: {
          tags: [PromptTags.TURNS],
        },
      });
    }

    if (nextTurn) {
      builder.assistantMessage(
        `Generate the next turn of the conversation: ${nextTurn}`,
        {
          extra: {
            tags: [PromptTags.TURNS],
          },
        }
      );
    }

    const queue = this.queue[journey.aiModel];
    const model = this.models[journey.aiModel];

    const res = await queue.add(
      builder,
      (bldr) => {
        return model._generateConversationTurn(bldr, material);
      },
      "generateConversationTurn"
    );

    if (this.considerAsNull.includes(res.nextTurn)) {
      res.nextTurn = null;
    }

    return {
      turn: res.turn,
      nextTurn: res.nextTurn,
    };
  }

  static async prepareConversation(
    builder: PromptBuilder,
    material: WithId<IMaterial>,
    journey: WithId<IJourney>
  ): Promise<{
    material: WithId<IMaterial>;
  }> {
    return await this.models[journey.aiModel]._prepareConversation(
      builder,
      material
    );
  }

  abstract readonly name: string;

  abstract _init(): Promise<void>;

  abstract _generateMaterial(
    builder: PromptBuilder,
    args: {
      language: SupportedLocale;
      userPath?: WithId<IUserPath>;
      journey?: WithId<IJourney>;
    }
  ): Promise<AIGenerationResponse>;

  abstract _generateConversationTurn(
    builder: PromptBuilder,
    material: WithId<IMaterial>
  ): Promise<{
    turn?: AIConversationTurn;
    nextTurn: string | null;
  }>;

  abstract _storeItemPicture(picture: {
    prompt: string;
    id: string;
  }): Promise<void>;

  abstract _prepareConversation(
    builder: PromptBuilder,
    material: WithId<IMaterial>
  ): Promise<{
    material: WithId<IMaterial>;
  }>;
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

  abstract _generateItemPicture(prompt: string): Promise<Buffer>;

  static async generateItemPicture(args: {
    prompt: string;
    model?: string;
  }): Promise<Buffer> {
    return this.models[args.model ?? "fake_img"]._generateItemPicture(
      args.prompt
    );
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
}
