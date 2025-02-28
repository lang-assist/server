import { ObjectId } from "mongodb";
import { VectorDbs, VectorIndex, VectorStoreField } from "../indexes";

export abstract class VectorDBBase {
  constructor() {}

  public abstract readonly name: VectorDbs;

  static dbs: { [key: string]: VectorDBBase } = {};

  static async init(dbs: VectorDBBase[]) {
    const promises: Promise<void>[] = [];
    for (const db of dbs) {
      this.dbs[db.name] = db;
      promises.push(db._init());
    }

    await Promise.all(promises);
  }

  abstract _init(): Promise<void>;

  abstract addEntry(
    index: VectorIndex,
    entry: {
      id: ObjectId;
      vector: Float32Array;
      metadata: any;
    }
  ): Promise<void>;

  abstract search(
    index: VectorIndex,
    query: Float32Array,
    options?: {
      maxDistance?: number;
      limit?: number;
      filter?: any;
    }
  ): Promise<
    {
      id: ObjectId;
      distance: number;
      metadata: any;
    }[]
  >;

  abstract exists(index: VectorIndex, id: ObjectId): Promise<boolean>;

  abstract deleteEntry(index: VectorIndex, id: ObjectId): Promise<void>;

  abstract hasIndex(index: VectorIndex): Promise<boolean>;

  abstract createIndex(
    index: VectorIndex,
    fields: VectorStoreField[]
  ): Promise<void>;

  abstract deleteIndex(index: VectorIndex): Promise<void>;

  abstract logIndex(index: VectorIndex): Promise<void>;

  abstract countIndex(index: VectorIndex): Promise<number>;
}
