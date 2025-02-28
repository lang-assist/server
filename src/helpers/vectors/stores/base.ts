import { ObjectId } from "mongodb";
import { GenerationContext } from "../../../types/ctx";
import { EmbeddingDim, EmbeddingGeneration } from "../../ai/embedding/base";
import { VectorDBBase } from "../dbs/base";
import { VectorDbs, VectorIndex, VectorStoreField } from "../indexes";
import {
  AIModels,
  VECTOR_STORE_DBS,
  VECTOR_STORE_DIMS,
  VECTOR_STORE_EMBEDDERS,
} from "../../../utils/constants";

export abstract class VectorStore<
  T extends {
    [key: string]: any;
  }
> {
  constructor(public index: VectorIndex, public fields: VectorStoreField[]) {
    this.embedder = VECTOR_STORE_EMBEDDERS[this.index];
    this.db = VECTOR_STORE_DBS[this.index];
    this.dim = VECTOR_STORE_DIMS[this.index] as EmbeddingDim;
  }

  public embedder: keyof typeof AIModels.embedding;
  public db: VectorDbs;
  public dim: EmbeddingDim;

  async addEntry(
    ctx: GenerationContext,
    id: ObjectId,
    text: string,
    entry: T
  ): Promise<void> {
    const vector = await new EmbeddingGeneration(
      text,
      this.dim,
      this.embedder,
      ctx,
      {
        reason: "addEntry",
      }
    ).generate();

    await this.dbInstance.addEntry(this.index, {
      id,
      vector,
      metadata: entry,
    });
  }

  async exists(id: ObjectId): Promise<boolean> {
    return this.dbInstance.exists(this.index, id);
  }

  async search(
    ctx: GenerationContext,
    query: string,
    options?: {
      maxDistance?: number;
      limit?: number;
      filter?: any;
    }
  ): Promise<
    {
      id: ObjectId;
      distance: number;
      metadata: T;
    }[]
  > {
    const vector = await new EmbeddingGeneration(
      query,
      this.dim,
      this.embedder,
      ctx,
      {
        reason: "search",
      }
    ).generate();

    const results = await this.dbInstance.search(this.index, vector, options);

    return results;
  }

  private get dbInstance() {
    return VectorDBBase.dbs[this.db]!;
  }

  async deleteEntry(index: VectorIndex, id: ObjectId): Promise<void> {
    await this.dbInstance.deleteEntry(index, id);
  }

  async hasIndex(): Promise<boolean> {
    return this.dbInstance.hasIndex(this.index);
  }

  async createIndex(): Promise<void> {
    await this.dbInstance.createIndex(this.index, this.fields);
  }

  async deleteIndex(): Promise<void> {
    await this.dbInstance.deleteIndex(this.index);
  }

  static stores: { [key in VectorIndex]?: VectorStore<any> } = {};

  static async init(stores: VectorStore<any>[]) {
    const promises: Promise<void>[] = [];

    for (const store of stores) {
      this.stores[store.index] = store;
      promises.push(store._init());
    }

    await Promise.all(promises);
  }

  async _init() {
    const db = VectorDBBase.dbs[this.db]!;

    if (!db) {
      throw new Error(`DB ${this.db} not found`);
    }

    const hasIndex = await db.hasIndex(this.index);

    if (!hasIndex) {
      await db.createIndex(this.index, this.fields);
    }
  }

  static getStore<T extends { [key: string]: any }>(
    index: VectorIndex
  ): VectorStore<T> {
    return this.stores[index]! as VectorStore<T>;
  }
}
