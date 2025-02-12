import { ObjectId } from "mongodb";
import { DbHelper } from "../helpers/db";

export interface IModel {
  hashWithAiModel: string;
  doc_ID: ObjectId;
}

export const Model = DbHelper.model<IModel>({
  collectionName: "doc-search",
  cacheById: true,
  createdAtField: true,
  updatedAtField: true,
  queryCacheFields: ["hashWithAiModel"],
  idFields: ["doc_ID"],
  indexes: [
    {
      key: {
        hashWithAiModel: 1,
      },
      unique: true,
      name: "hashWithAiModel_unique",
    },
  ],
});
