import { Generation, GenerationContext, GenType } from "../../../types/ctx";
import { AIModels } from "../../../utils/constants";
export type EmbeddingDim = 1536 | 1024 | 512 | 256;

export class EmbeddingGeneration extends Generation<Float32Array> {
  constructor(
    public text: string,
    public dim: EmbeddingDim,
    public modelName: keyof typeof AIModels.embedding,
    ctx: GenerationContext,
    meta: {
      reason: string;
      [key: string]: any;
    }
  ) {
    super(ctx, meta);
  }

  public get embeddingModel(): keyof typeof AIModels.embedding {
    return this.modelName;
  }

  get genType(): GenType {
    return "embedding";
  }
}

// export abstract class AIEmbeddingModel {
//   constructor(public readonly _prices: BrocaTypes.AI.Types.AIPricing) {}

//   static defaultModel = "text-embedding-3-large";

//   abstract readonly name: string;

//   abstract _init(): Promise<void>;

//   abstract _generateEmbedding(
//     text: string,
//     dim: EmbeddingDim
//   ): Promise<{
//     vector: Float32Array;
//     usage: BrocaTypes.AI.Types.AIUsage;
//   }>;

//   static models: { [key: string]: AIEmbeddingModel } = {};

//   static async init(models: { [key: string]: AIEmbeddingModel }) {
//     this.models = models;
//     for (const key in this.models) {
//       await this.models[key]._init();
//     }
//     // await this.createDocIndexIfNotExists();
//   }

//   // static async embedText(args: {
//   //   text: string;
//   //   dim: EmbeddingDim;
//   //   model?: string;
//   // }): Promise<Float32Array> {
//   //   return this.models[args.model ?? this.defaultModel]._generateEmbedding(
//   //     args.text,
//   //     args.dim
//   //   );
//   // }

//   // static defaultDim: EmbeddingDim = 1536;

//   // static async deleteVoiceEmbeddings() {
//   //   await Voices.updateMany(
//   //     {
//   //       embedding: { $exists: true },
//   //     },
//   //     // @ts-ignore
//   //     { $unset: { embedding: "" } }
//   //   );
//   // }

//   // static voiceInstructions(
//   //   voice: WithId<IVoices>,
//   //   options?: {
//   //     withShortName?: boolean;
//   //     withSecondaryLocales?: boolean;
//   //     withPersonalities?: boolean;
//   //     withStyles?: boolean;
//   //     withTailoredScenarios?: boolean;
//   //     overrideSingleLocale?: string;
//   //   }
//   // ): MessageBuilder {
//   //   const {
//   //     withShortName = false,
//   //     withSecondaryLocales = false,
//   //     withPersonalities = false,
//   //     withStyles = true,
//   //     withTailoredScenarios = false,
//   //     overrideSingleLocale,
//   //   } = options ?? {};

//   //   const message = msg();

//   //   if (withShortName) {
//   //     message.addKv("name", voice.shortName);
//   //   }

//   //   if (voice.gender === "Neutral") {
//   //     message.addKv("gender", "unisex");
//   //   } else {
//   //     message.addKv("gender", voice.gender);
//   //   }

//   //   const locales = [];

//   //   if (overrideSingleLocale) {
//   //     locales.push(overrideSingleLocale);
//   //   } else {
//   //     locales.push(voice.locale.replace("_", "-"));
//   //   }

//   //   if (withSecondaryLocales) {
//   //     locales.push(
//   //       ...(voice.secondaryLocales ?? []).map((l) => l.replace("_", "-"))
//   //     );
//   //   }

//   //   message.addKv("locales", locales.join(", "));

//   //   if (
//   //     withPersonalities &&
//   //     voice.personalities &&
//   //     voice.personalities.length > 0
//   //   ) {
//   //     message.addKv("personalities", voice.personalities.join(", "));
//   //   }

//   //   if (withStyles && voice.styles && voice.styles.length > 0) {
//   //     message.addKv("styles", voice.styles.join(", "));
//   //   }

//   //   if (
//   //     withTailoredScenarios &&
//   //     voice.tailoredScenarios &&
//   //     voice.tailoredScenarios.length > 0
//   //   ) {
//   //     message.addKv("scenarios", voice.tailoredScenarios.join(", "));
//   //   }

//   //   return message;
//   // }

//   // static async generateEmbeddingsForVoices() {
//   //   const voices = await Voices.find(
//   //     {
//   //       embedding: {
//   //         $exists: false,
//   //       },
//   //     },
//   //     {
//   //       limit: 1000,
//   //     }
//   //   );

//   //   var i = 0;

//   //   let promises: Promise<void>[] = [];

//   //   for (const voice of voices) {
//   //     promises.push(
//   //       (async () => {
//   //         const instructions = AIEmbeddingGenerator.voiceInstructions(voice, {
//   //           withPersonalities: true,
//   //           withStyles: true,
//   //           withTailoredScenarios: true,
//   //           withSecondaryLocales: true,
//   //           withShortName: false,
//   //         });

//   //         const embedding = await AIEmbeddingGenerator.embedText({
//   //           text: instructions.build(),
//   //           model: this.defaultModel,
//   //           dim: AIEmbeddingGenerator.defaultDim,
//   //         });
//   //         await Voices.findByIdAndUpdate(voice._id, {
//   //           $set: {
//   //             embedding: Array.from(embedding),
//   //           },
//   //         });
//   //       })()
//   //     );
//   //     i++;
//   //     if (i % 30 === 0) {
//   //       await Promise.all(promises);
//   //       promises = [];
//   //     }
//   //   }

//   //   await Promise.all(promises);
//   // }

//   // static async deleteIndex() {
//   //   const redisClient: RedisClientType = DbHelper.cacheHelper!.client;
//   //   try {
//   //     await redisClient.ft.dropIndex("idx:voices");
//   //   } catch (e) {
//   //     console.error(e);
//   //   }
//   //   try {
//   //     const keys = await redisClient.keys("voices:*");
//   //     await redisClient.del(keys);
//   //   } catch (e) {
//   //     console.error(e);
//   //   }
//   // }

//   // static async cacheVoiceEmbeddings() {
//   //   let skip = 0;

//   //   const redisClient: RedisClientType = DbHelper.cacheHelper!.client;

//   //   let hasIndex = false;

//   //   try {
//   //     await redisClient.ft.info("idx:voices");
//   //     hasIndex = true;
//   //   } catch (e) {
//   //     console.error(e);
//   //   }

//   //   if (!hasIndex) {
//   //     redisClient.ft.create(
//   //       "idx:voices",
//   //       {
//   //         id: {
//   //           type: SchemaFieldTypes.TEXT,
//   //           NOINDEX: true,
//   //         },
//   //         vector: {
//   //           type: SchemaFieldTypes.VECTOR,
//   //           ALGORITHM: VectorAlgorithms.FLAT,
//   //           TYPE: "FLOAT32",
//   //           DIM: AIEmbeddingGenerator.defaultDim,
//   //           DISTANCE_METRIC: "COSINE",
//   //         },
//   //         gender: {
//   //           type: SchemaFieldTypes.TAG,
//   //         },
//   //       },
//   //       {
//   //         PREFIX: ["voice_vectors:", "idx:voices:", "voice_vectors:*"],
//   //         ON: "HASH",
//   //       }
//   //     );
//   //   }

//   //   while (true) {
//   //     const voices = await Voices.find(
//   //       {
//   //         embedding: { $exists: true },
//   //       },
//   //       { skip, limit: 10 }
//   //     );

//   //     if (voices.length === 0) {
//   //       break;
//   //     }

//   //     skip += 10;

//   //     for (const voice of voices) {
//   //       const buffer = Buffer.from(Float32Array.from(voice.embedding!).buffer);

//   //       await redisClient.hSet(`voice_vectors:${voice._id}`, {
//   //         gender: voice.gender,
//   //         vector: buffer,
//   //         id: voice._id.toHexString(),
//   //       });
//   //     }
//   //   }
//   // }

//   // static async searchVoice(args: {
//   //   query: string;
//   //   gender?: "Male" | "Female" | "Neutral";
//   //   model?: string;
//   // }): Promise<(WithId<IVoices> & { distance: any; score: any })[]> {
//   //   const redisClient: RedisClientType = DbHelper.cacheHelper!.client;

//   //   const queryEmbedding = await AIEmbeddingGenerator.embedText({
//   //     text: args.query,
//   //     model: this.defaultModel,
//   //     dim: AIEmbeddingGenerator.defaultDim,
//   //   });

//   //   const vectorBlob = Buffer.from(queryEmbedding.buffer);

//   //   try {
//   //     let q = "*";

//   //     // if (args.gender && args.gender !== "Neutral") {
//   //     //   q = `(@gender:{${args.gender}})`;
//   //     // }

//   //     const results = await redisClient.ft.search(
//   //       "idx:voices",
//   //       `${q}=>[KNN 10 @vector $BLOB as dist]`,
//   //       {
//   //         PARAMS: {
//   //           BLOB: vectorBlob,
//   //         },
//   //         SORTBY: {
//   //           BY: "dist",
//   //           DIRECTION: "ASC",
//   //         },
//   //         DIALECT: 4,
//   //       }
//   //     );

//   //     return await Promise.all(
//   //       results.documents.map(async (doc) => {
//   //         const voice = await Voices.findById(
//   //           new ObjectId(doc.value.id as string)
//   //         );

//   //         return {
//   //           ...voice!,
//   //           distance: doc.value.dist,
//   //           score: doc.value.score,
//   //         };
//   //       })
//   //     );
//   //   } catch (e) {
//   //     console.error(e);
//   //     return [];
//   //   }
//   // }

//   // static async selectVoice(conversationDetails: ConversationDetails): Promise<{
//   //   [key: string]: string;
//   // }> {
//   //   const characters = conversationDetails.characters;

//   //   const voices = await Promise.all(
//   //     characters
//   //       .filter((c) => c.name !== "$user")
//   //       .map(async (character) => {
//   //         const q = msg();

//   //         q.addKv("Character", character.description);
//   //         q.addKv("Locale", character.locale);
//   //         q.addKv("Scenario", conversationDetails.scenarioScaffold);

//   //         const voice = await AIEmbeddingGenerator.searchVoice({
//   //           query: q.build(),
//   //           gender: character.gender,
//   //         });

//   //         if (voice.length === 0) {
//   //           // find brute force
//   //           const voice = await Voices.findOne({
//   //             // locale eq character.locale or secondary locales includes character.locale
//   //             $or: [
//   //               { locale: character.locale },
//   //               {
//   //                 secondaryLocales: {
//   //                   $in: [character.locale.replace("-", "_")],
//   //                 },
//   //               },
//   //             ],
//   //           });

//   //           if (!voice) {
//   //             throw new Error(`No voice found for character ${character.name}`);
//   //           }

//   //           return {
//   //             [character.name]: voice._id.toHexString(),
//   //           };
//   //         }

//   //         return {
//   //           [character.name]: voice[0]._id.toHexString(),
//   //         };
//   //       })
//   //   );

//   //   return Object.assign({}, ...voices);
//   // }

//   // static async createDocIndexIfNotExists() {
//   //   const redisClient: RedisClientType = DbHelper.cacheHelper!.client;

//   //   try {
//   //     await redisClient.ft.info("idx:docs");
//   //     return;
//   //   } catch (e) {
//   //     console.error(e);
//   //   }

//   //   await redisClient.ft.create(
//   //     "idx:docs",
//   //     {
//   //       id: {
//   //         type: SchemaFieldTypes.TEXT,
//   //         NOINDEX: true,
//   //       },
//   //       vector: {
//   //         type: SchemaFieldTypes.VECTOR,
//   //         ALGORITHM: VectorAlgorithms.FLAT,
//   //         TYPE: "FLOAT32",
//   //         DIM: AIEmbeddingGenerator.defaultDim,
//   //         DISTANCE_METRIC: "COSINE",
//   //       },
//   //       summary: {
//   //         type: SchemaFieldTypes.TEXT,
//   //         NOINDEX: true,
//   //       },
//   //       aiModel: {
//   //         type: SchemaFieldTypes.TAG,
//   //         NOINDEX: false,
//   //       },
//   //       language: {
//   //         type: SchemaFieldTypes.TAG,
//   //         NOINDEX: false,
//   //       },
//   //     },
//   //     {
//   //       PREFIX: ["doc_vectors:", "idx:docs:", "doc_vectors:*"],
//   //       ON: "HASH",
//   //     }
//   //   );
//   // }

//   // static async deleteDocIndex() {
//   //   const redisClient: RedisClientType = DbHelper.cacheHelper!.client;
//   //   await redisClient.ft.dropIndex("idx:docs");
//   // }

//   // static async cacheDocVector(input: {
//   //   id: ObjectId;
//   //   aiModel: string;
//   //   language: string;
//   //   summary: string;
//   // }) {
//   //   const redisClient: RedisClientType = DbHelper.cacheHelper!.client;

//   //   const embedding = await this.embedText({
//   //     text: input.summary,
//   //     dim: AIEmbeddingGenerator.defaultDim,
//   //   });

//   //   const buffer = Buffer.from(embedding.buffer);

//   //   const aiModel = input.aiModel.replaceAll("-", "_");
//   //   const language = input.language.replaceAll("-", "_");

//   //   await redisClient.hSet(`doc_vectors:${input.id}`, {
//   //     id: input.id.toHexString(),
//   //     vector: buffer,
//   //     aiModel: aiModel,
//   //     language: language,
//   //     summary: input.summary,
//   //   });
//   // }

//   // static async searchDoc(args: {
//   //   query: string;
//   //   aiModel: string;
//   //   language: string;
//   //   limit: number;
//   //   maxDistance: number;
//   // }): Promise<
//   //   WithId<{
//   //     summary: string;
//   //   }>[]
//   // > {
//   //   const redisClient: RedisClientType = DbHelper.cacheHelper!.client;

//   //   const queryEmbedding = await this.embedText({
//   //     text: args.query,
//   //     dim: AIEmbeddingGenerator.defaultDim,
//   //   });

//   //   const vectorBlob = Buffer.from(queryEmbedding.buffer);

//   //   const aiModel = args.aiModel.replaceAll("-", "_");
//   //   const language = args.language.replaceAll("-", "_");

//   //   let q = `(@aiModel:{${aiModel}} @language:{${language}})`;

//   //   const results = await redisClient.ft.search(
//   //     "idx:docs",
//   //     `${q}=>[KNN 10 @vector $BLOB as dist]`,
//   //     {
//   //       PARAMS: {
//   //         BLOB: vectorBlob,
//   //       },
//   //       SORTBY: {
//   //         BY: "dist",
//   //         DIRECTION: "ASC",
//   //       },
//   //       DIALECT: 4,
//   //     }
//   //   );

//   //   const filtered = results.documents.filter((doc) => {
//   //     if (doc.value && doc.value.dist) {
//   //
//   //       return (doc.value.dist! as number) <= args.maxDistance;
//   //     }
//   //     return false;
//   //   });

//   //   return filtered.slice(0, args.limit).map((doc) => {
//   //     return {
//   //       _id: new ObjectId(doc.value.id as string),
//   //       summary: doc.value.summary as string,
//   //     };
//   //   });
//   // }
// }
