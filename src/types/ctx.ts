// // export class Generation<
// //   C extends GenerationContext<T, R>,
// //   T extends MsgGenerationType,
// //   R
// // > {
// //   constructor(public context: C, public type: T) {}

import { BrocaTypes } from ".";
import { log } from "../helpers/log";
import { GenCtx } from "../models/_index";
import { AIError, AIRateLimitError, MultipleAIError } from "../utils/ai-types";
import { Completer, createCompleter } from "../utils/completer";
import { AIModels, settlePromises } from "../utils/constants";
import { randomString } from "../utils/random";

type QueueItem<G extends Generation<any>> = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  gen: G;
  promise: (gen: G) => Promise<{
    res?: any;
    usage?: BrocaTypes.AI.Types.AIUsage;
    error?: AIError;
  }>;
};

export class AIModelQueue<G extends Generation<any>> {
  constructor(
    public model: string,
    public maxTries: number,
    public concurrency: number,
    public pricing: BrocaTypes.AI.Types.AIPricing,
    public extraChecks: ((
      res: any,
      resolve: (value: void) => void,
      reject: (err: AIError) => void
    ) => void)[] = []
  ) {}

  private queue: QueueItem<G>[] = [];
  private running: QueueItem<G>[] = [];

  public add(
    gen: G,
    promise: (gen: G) => Promise<{
      res?: any;
      usage?: BrocaTypes.AI.Types.AIUsage;
      error?: AIError;
    }>
  ) {
    return new Promise<{
      res?: any;
      usage?: BrocaTypes.AI.Types.AIUsage;
      error?: AIError;
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

  private _insertFirst(item: QueueItem<G>) {
    this.queue.unshift(item);
  }

  private _remove(item: QueueItem<G>) {
    this.queue = this.queue.filter((i) => i.gen.id !== item.gen.id);
    this.running = this.running.filter((i) => i.gen.id !== item.gen.id);
    this._checkNeedRunning();
  }

  private _setItRunning(item: QueueItem<G>) {
    this.queue = this.queue.filter((i) => i.gen.id !== item.gen.id);
    this.running.push(item);
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

  private _handleError(item: QueueItem<G>, e: AIError) {
    item.gen.ctx.addError(e);

    if (item.gen.tries >= (item.gen.ctx.maxTries ?? this.maxTries)) {
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

    // if (e instanceof AIInvalidSchemaError) {
    //   const schema = e.schema;

    //   item.gen.builder.userMessage(
    //     `The schema is invalid. Please fix it and try again`
    //   );

    //   item.gen.builder.userMessage(
    //     `This message was: ${JSON.stringify(e.thisResponse)}`
    //   );

    //   item.gen.builder.userMessage(
    //     `Required schema is: ${JSON.stringify(schema)}`
    //   );
    //   this._remove(item);
    //   this._insertFirst(item);
    //   this._run();

    //   return;
    // }

    item.reject(e);
    this._remove(item);
  }

  private async _run() {
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
      this._setItRunning(item);
      item
        .promise(item.gen)
        .then((res) => {
          if (res.usage) {
            item.gen.ctx.addUsage(
              item.gen.genType,
              res.usage,
              this.pricing,
              item.gen.meta
            );
          }
          if (res.error) {
            this._handleError(item, res.error);
            return;
          }

          Promise.all(
            this.extraChecks.map((check) => {
              return new Promise((resolve, reject) => {
                check(res?.res, resolve, reject);
              });
            })
          )
            .then(() => {
              this._remove(item);
              item.resolve(res);
            })
            .catch((e) => {
              this._handleError(item, e);
            });
        })
        .catch((e) => {
          this._handleError(item, e);
        });
    }
  }

  _checkNeedRunning() {
    if (!this._isFull() && !this._isEmpty()) {
      this._run();
    }
  }
}

export abstract class Generation<R> {
  constructor(
    public ctx: GenerationContext,
    public meta: {
      reason: string;
      [key: string]: any;
    }
  ) {}

  async generate(): Promise<R> {
    try {
      return await AIModel.generate(this);
    } catch (e) {
      this.ctx.addError(e as Error);
      throw e;
    }
  }

  public abstract get genType(): GenType;

  public tries: number = 0;

  public id: string = randomString(32);
}

export type GenType = "chat" | "tts" | "stt" | "img" | "embedding";

type AllModels =
  | keyof typeof AIModels.chat
  | keyof typeof AIModels.tts
  | keyof typeof AIModels.stt
  | keyof typeof AIModels.img
  | keyof typeof AIModels.embedding;

export abstract class AIModel<G extends Generation<R>, R = any> {
  constructor(
    public genType: GenType,
    public readonly _prices: BrocaTypes.AI.Types.AIPricing
  ) {}

  private static queue: {
    [model: string]: AIModelQueue<any>;
  } = {};

  static models: {
    [genType in GenType]: {
      [key: string]: AIModel<any>;
    };
  } = {
    chat: {},
    tts: {},
    stt: {},
    img: {},
    embedding: {},
  };

  static hasModels(models: {
    [key in GenType]?: string[];
  }) {
    for (const key of Object.keys(models)) {
      if (!this.models[key as GenType]) {
        return false;
      }
      for (const model of models[key as GenType] ?? []) {
        if (!this.models[key as GenType][model]) {
          return false;
        }
      }
    }

    return true;
  }

  static async init(models: { [key in AllModels]: AIModel<any> }) {
    for (const key in models) {
      const model = models[key as AllModels];

      this.models[model.genType][key] = model;
      this.queue[key] = new AIModelQueue(
        key,
        this.models[model.genType][key].maxTries,
        this.models[model.genType][key].concurrency,
        this.models[model.genType][key]._prices
      );
    }
    await Promise.all(Object.values(models).map((model) => model._init()));
  }

  static async generate<G extends Generation<R>, R>(gen: G): Promise<R> {
    let modelName;

    switch (gen.genType) {
      case "chat":
        modelName = gen.ctx.chatModel;
        break;
      case "tts":
        modelName = gen.ctx.ttsModel;
        break;
      case "stt":
        modelName = gen.ctx.sttModel;
        break;
      case "img":
        modelName = gen.ctx.imgModel;
        break;
      case "embedding":
        // EmbeddingGeneration is not imported here because import causes a circular dependency
        modelName = (gen as any).embeddingModel;
        break;
    }

    const queue = this.queue[modelName];
    const model = this.models[gen.genType][modelName];

    const aiResponse = await queue.add(gen, model._generate.bind(model));

    return aiResponse.res as R;
  }

  abstract _generate(gen: G): Promise<BrocaTypes.AI.GenerationResponse<R>>;

  abstract readonly name: string;

  abstract readonly maxTries: number;

  abstract readonly concurrency: number;

  abstract _init(): Promise<void>;
}

// export class MultiGeneration extends Generation<void> {
//   async generate(ctx: GenerationContext): Promise<void> {
//     const promises = this.gens.map((g) => g.generate(ctx));

//     const results = await Promise.all(promises);

//     const usage = results.reduce(
//       (acc, curr) => {
//         return {
//           input: (acc.input ?? 0) + (curr.usage?.input ?? 0),
//           output: (acc.output ?? 0) + (curr.usage?.output ?? 0),
//         };
//       },
//       { input: 0, output: 0 }
//     );

//     const errors = results
//       .filter((r) => r.error)
//       .map((r) => r.error) as AIError[];

//     if (errors.length > 0) {
//       ctx.addError(
//         new MultipleAIError("Multiple errors", errors)
//       );
//     }

//     if (usage) {
//       ctx.addUsage(usage);
//     }

//     return {
//       usage,
//       error:
//         errors.length > 0
//           ? new MultipleAIError("Multiple errors", errors)
//           : undefined,
//     };
//   }
//   constructor(public gens: Generation<any>[]) {
//     super();
//   }
// }

// export class GenerationContext<
//   S extends string = string,
//   F extends string = string
// > {
//   constructor() {}
// }

type NormalStatus = "idle" | "pre-gen" | "generated" | "completed";

type ErrorStatus = "generating-error" | "pre-gen-error" | "post-gen-error";

type AllStatus = NormalStatus | ErrorStatus;

const statuses = ["idle", "pre-gen", "generated", "completed"];

export abstract class GenerationContext {
  constructor(status: AllStatus, public reason: string) {
    this._status = status;
  }

  abstract toJSON(): any;

  public maxTries: number | undefined;

  public get chatModel(): keyof typeof AIModels.chat {
    throw new Error("Method not implemented.");
  }
  public get ttsModel(): keyof typeof AIModels.tts {
    throw new Error("Method not implemented.");
  }
  public get sttModel(): keyof typeof AIModels.stt {
    throw new Error("Method not implemented.");
  }
  public get imgModel(): keyof typeof AIModels.img {
    throw new Error("Method not implemented.");
  }

  private _status: AllStatus;

  public get status(): AllStatus {
    return this._status;
  }

  private _calculateCosts(
    usage: BrocaTypes.AI.Types.AIUsage,
    pricing: BrocaTypes.AI.Types.AIPricing
  ): BrocaTypes.AI.Types.AIUsage {
    const per = pricing.per;
    return {
      input: (usage.input / per) * pricing.input,
      output: (usage.output / per) * pricing.output,
      cachedInput:
        usage.cachedInput && pricing.cachedInput
          ? (usage.cachedInput / per) * pricing.cachedInput
          : undefined,
      cacheWrite:
        usage.cacheWrite && pricing.cacheWrite
          ? (usage.cacheWrite / per) * pricing.cacheWrite
          : undefined,
    };
  }

  public get usageInfo(): {
    usages: {
      usage: BrocaTypes.AI.Types.AIUsage;
      costs: BrocaTypes.AI.Types.AIUsage;
      total: number;
      genType: GenType;
    }[];
    totalCosts: {
      [key in GenType]: number;
    };
    total: number;
  } {
    const usages: {
      usage: BrocaTypes.AI.Types.AIUsage;
      costs: BrocaTypes.AI.Types.AIUsage;
      total: number;
      genType: GenType;
    }[] = [];

    let totalCosts: {
      [key in GenType]: number;
    } = {
      chat: 0,
      tts: 0,
      stt: 0,
      img: 0,
      embedding: 0,
    };

    let total = 0;

    for (const usage of this._usages) {
      const costs = this._calculateCosts(usage.usage, usage.pricing);

      const add =
        costs.input +
        costs.output +
        (costs.cachedInput ?? 0) +
        (costs.cacheWrite ?? 0);

      totalCosts[usage.genType] += add;
      total += add;
      usages.push({
        usage: usage.usage,
        costs,
        total: add,
        genType: usage.genType,
      });
    }

    return { usages, totalCosts, total };
  }

  public startGeneration() {
    this.setStatusReached("pre-gen");
  }

  public async complete() {
    this.setStatusReached("generated");

    if (this._postGens.length > 0) {
      const results = await settlePromises(this._postGens);
      const errors = results.filter((r) => r instanceof Error);
      if (errors.length > 0) {
        for (const error of errors) {
          this.addError(error);
        }
        this.setStatusReached("post-gen-error");
      } else {
        this.setStatusReached("completed");
      }
    } else {
      this.setStatusReached("completed");
    }
  }

  private _postGens: Promise<any>[] = [];

  public addPostGen(...gens: Promise<any>[]) {
    this._postGens.push(...gens);
  }

  private _statusReached(status: AllStatus) {
    const targetIndex = statuses.indexOf(status);
    const currentIndex = statuses.indexOf(this._status);
    return targetIndex <= currentIndex;
  }

  private setStatusReached(status: AllStatus) {
    if (this._statusReached(status)) {
      log.error("Status already reached", { status, current: this._status });
      throw new Error("Status already reached");
    }

    this._status = status;

    if (this._statusListeners[status]) {
      this._statusListeners[status].forEach((cb) => cb());
    }
    if (
      status === "completed" ||
      status === "pre-gen-error" ||
      status === "post-gen-error" ||
      status === "generating-error"
    ) {
      const completers = this._completers;

      for (const key in completers) {
        if (completers[key as AllStatus]) {
          const completer = completers[key as AllStatus]!;
          if (completer.isCompleted) {
            continue;
          }
          if (status === "completed") {
            completer.complete();
          } else {
            completer.completeError(new Error(status));
          }
        }
      }

      const { usages, totalCosts, total } = this.usageInfo;
      GenCtx.insertOne({
        usages,
        totalCosts,
        total,
        errors: this._errors,
        status: this._status,
        data: this.toJSON(),
      });
    }
  }

  private _statusListeners: {
    [key in AllStatus]?: (() => void)[];
  } = {};

  private _completers: {
    [key in AllStatus]?: Completer<void>;
  } = {};

  private _errors: AIError[] = [];

  public addError(error: Error) {
    if (error instanceof AIError) {
      this._errors.push(error);
    } else {
      this._errors.push(new AIError(error.message));
    }
  }

  public get errors() {
    return this._errors;
  }

  private _usages: ({
    usage: BrocaTypes.AI.Types.AIUsage;
    pricing: BrocaTypes.AI.Types.AIPricing;
    genType: GenType;
  } & {
    meta: {
      reason: string;
      [key: string]: any;
    };
  })[] = [];

  public addUsage(
    genType: GenType,
    usage: BrocaTypes.AI.Types.AIUsage,
    pricing: BrocaTypes.AI.Types.AIPricing,
    meta: {
      reason: string;
      [key: string]: any;
    }
  ) {
    this._usages.push({ usage, pricing, genType, meta });
  }

  private onStatus(status: AllStatus, callback: () => void) {
    this._statusListeners[status] = this._statusListeners[status] || [];
    this._statusListeners[status].push(callback);
  }

  private async statusCompleter(status: NormalStatus) {
    if (this._status === status) {
      return;
    }

    const currentIndex = statuses.indexOf(this._status);
    const targetIndex = statuses.indexOf(status);

    if (currentIndex > targetIndex) {
      return;
    }

    if (!this._completers[status]) {
      this._completers[status] = createCompleter<void>();
    }

    await this._completers[status]!.future;
  }

  private async anyStatusCompleter(statusses: NormalStatus[]) {
    await new Promise<void>((resolve) => {
      let resolved = false;
      statusses.forEach(async (status) => {
        await this.statusCompleter(status);
        if (!resolved) {
          resolved = true;
          resolve();
        }
      });
    });
  }

  public async waitUntil(status: NormalStatus) {
    if (statuses.indexOf(status) > statuses.indexOf(this._status)) {
      await this.statusCompleter(status);
    }
  }
}
