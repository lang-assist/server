import {
  RedisClientType,
  RediSearchSchema,
  SchemaFieldTypes,
  VectorAlgorithms,
} from "redis";
import { DbHelper, ObjectId } from "../../db";
import { VectorDBBase } from "./base";
import { VectorDbs, VectorIndex, VectorStoreField } from "../indexes";
import { VECTOR_STORE_DIMS } from "../../../utils/constants";
import { log } from "../../log";

export class RedisVectorDB extends VectorDBBase {
  async addEntry(
    index: VectorIndex,
    entry: { id: ObjectId; vector: Float32Array; metadata: any }
  ): Promise<void> {
    const res = await this.client.hSet(`${index}:${entry.id.toHexString()}`, {
      id: entry.id.toHexString(),
      vector: Buffer.from(entry.vector.buffer),
      ...entry.metadata,
    });
  }

  async search(
    index: VectorIndex,
    queryVector: Float32Array,
    options?: {
      maxDistance?: number;
      limit?: number;
      filter?: {
        [key: string]: string;
      };
    }
  ): Promise<{ id: ObjectId; distance: number; metadata: any }[]> {
    const vectorBlob = Buffer.from(queryVector.buffer);

    let q = "*";

    const filter = options?.filter;

    if (filter) {
      q = Object.entries(filter)
        .map(([key, value]) => `@${key}:{${value}}`)
        .join(" ");
      q = `(${q})`;
    }

    const reqStr = `${q} => [KNN ${
      options?.limit ?? 10
    } @vector $BLOB as dist]`;

    const results = await this.client.ft.search(index, reqStr, {
      PARAMS: {
        BLOB: vectorBlob,
      },
      SORTBY: {
        BY: "dist",
        DIRECTION: "ASC",
      },
      DIALECT: 4,
    });

    return results.documents.map((doc) => {
      const metadata = doc.value;
      delete metadata.vector;
      return {
        id: new ObjectId(doc.value.id as string),
        distance: parseFloat(doc.value.dist as string),
        metadata,
      };
    });
  }

  async deleteEntry(index: VectorIndex, id: ObjectId): Promise<void> {
    await this.client.del(`${index}:${id.toHexString()}`);
  }

  async hasIndex(index: VectorIndex): Promise<boolean> {
    try {
      await this.client.ft.info(index);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
  async createIndex(
    index: VectorIndex,
    fields: VectorStoreField[]
  ): Promise<void> {
    const add: {
      [key: string]: {
        type: SchemaFieldTypes;
        NOINDEX?: boolean;
      };
    } = {};

    for (const field of fields) {
      add[field.name] = {
        type: SchemaFieldTypes.TAG,
        NOINDEX: !field.index,
      };
    }

    await this.client.ft.create(
      index,
      {
        id: {
          type: SchemaFieldTypes.TEXT,
          NOINDEX: true,
        },
        ...add,
        vector: {
          type: SchemaFieldTypes.VECTOR,
          ALGORITHM: VectorAlgorithms.FLAT,
          TYPE: "FLOAT32",
          DIM: VECTOR_STORE_DIMS[index],
          DISTANCE_METRIC: "COSINE",
        },
      },
      {
        ON: "HASH",
        PREFIX: [`${index}:*`, `${index}:`],
      }
    );
  }

  async deleteIndex(index: VectorIndex): Promise<void> {
    await this.client.ft.dropIndex(index);
    const keys = await this.client.keys(`${index}:*`);
    await this.client.del(keys);
  }

  async _init(): Promise<void> {
    return;
  }

  async logIndex(index: VectorIndex): Promise<void> {
    const info = await this.client.ft.info(index);
    log.info(info);
    return;
  }

  async countIndex(index: VectorIndex): Promise<number> {
    const info = await this.client.ft.info(index);
    return parseInt(info.numDocs);
  }

  _redisClient?: RedisClientType;

  get client(): RedisClientType {
    if (!this._redisClient) {
      this._redisClient = DbHelper.cacheHelper!.client;
    }
    return this._redisClient;
  }

  async exists(index: VectorIndex, id: ObjectId): Promise<boolean> {
    const result = await this.client.hGet(`${index}:${id.toHexString()}`, "id");
    return result !== null;
  }

  readonly name: VectorDbs = "redis";

  constructor() {
    super();
  }
}
