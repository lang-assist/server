import { ObjectId } from "mongodb";
import { COLLECTIONS } from "../utils/constants";
import { DbHelper } from "../helpers/db";

export interface IModel {
  hashWithAiModel: string;
  doc_ID: ObjectId;
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.DOC_SEARCHES,
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
