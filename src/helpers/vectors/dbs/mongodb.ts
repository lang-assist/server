import { Binary, Collection, MongoClient, ObjectId } from "mongodb";
import { DbHelper } from "../../db";
import { VectorDbs, VectorIndex, VectorStoreField } from "../indexes";
import { VectorDBBase } from "./base";
import { VECTOR_STORE_DIMS } from "../../../utils/constants";
import { log } from "../../log";

export class MongoDBVectorDB extends VectorDBBase {
  async _init(): Promise<void> {
    await this.client.db().listCollections().toArray();
  }

  private get client(): MongoClient {
    return DbHelper.clients["vector"];
  }

  private collection(index: VectorIndex): Collection<any> {
    return this.client.db().collection(index);
  }

  async addEntry(
    index: VectorIndex,
    entry: { id: ObjectId; vector: Float32Array; metadata: any }
  ): Promise<void> {
    await this.collection(index).insertOne({
      _id: entry.id,
      vector: Buffer.from(entry.vector.buffer),
      metadata: entry.metadata,
    });
  }

  async search(
    index: VectorIndex,
    query: Float32Array,
    options?: {
      maxDistance?: number;
      limit?: number;
      filter?: {
        [key: string]: string;
      };
    }
  ): Promise<{ id: ObjectId; distance: number; metadata: any }[]> {
    const vectorBlob = Binary.fromFloat32Array(query);

    const aggregation = [];

    if (options?.filter) {
      aggregation.push({
        $match: {
          ...Object.entries(options.filter).map(([key, value]) => ({
            [`metadata.${key}`]: value,
          })),
        },
      });
    }

    aggregation.push({
      $vectorSearch: {
        exact: false,
        queryVector: vectorBlob,
        path: "vector",
        index: index,
        numCandidates: 100,
        limit: options?.limit ?? 10,
      },
    });

    aggregation.push({
      $project: {
        _id: 1,
        distance: 1,
        metadata: 1,
      },
    });

    aggregation.push({
      $sort: {
        distance: -1,
      },
    });

    const results = await this.collection(index)
      .aggregate(aggregation)
      .toArray();

    return results.map((r) => ({
      id: r._id,
      distance: r.distance,
      metadata: r.metadata,
    }));
  }

  async deleteEntry(index: VectorIndex, id: ObjectId): Promise<void> {
    await this.collection(index).deleteOne({ _id: id });
  }

  async hasIndex(index: VectorIndex): Promise<boolean> {
    const indexes = await this.collection(index).listSearchIndexes().toArray();
    return indexes.some((i) => i.name === index);
  }
  async createIndex(
    index: VectorIndex,
    fields: VectorStoreField[]
  ): Promise<void> {
    await this.collection(index).createSearchIndex({
      name: index,
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            numDimensions: VECTOR_STORE_DIMS[index],
            similarity: "cosine",
            path: "vector",
          },
          ...fields
            .filter((f) => f.index)
            .map((field) => ({
              type: "text",
              path: `metadata.${field.name}`,
            })),
        ],
      },
    });
  }

  async deleteIndex(index: VectorIndex): Promise<void> {
    await this.collection(index).dropSearchIndex(index);
  }

  async logIndex(index: VectorIndex): Promise<void> {
    const info = await this.collection(index).listSearchIndexes().toArray();
    log.info(info);
  }

  async countIndex(index: VectorIndex): Promise<number> {
    const info = await this.collection(index).listSearchIndexes().toArray();
    return info.length;
  }

  async exists(index: VectorIndex, id: ObjectId): Promise<boolean> {
    const result = await this.collection(index).findOne({ _id: id });
    return result !== null;
  }

  readonly name: VectorDbs = "mongodb";

  constructor() {
    super();
  }
}
