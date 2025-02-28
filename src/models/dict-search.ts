import { ObjectId } from "mongodb";
import { COLLECTIONS } from "../utils/constants";
import { DbHelper } from "../helpers/db";

export interface IModel {
  hashWithAiModel: string;
  dict_ID: ObjectId;
  definitionId?: string;
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.DICT_SEARCHES,
  cacheById: true,
  createdAtField: true,
  updatedAtField: true,
  queryCacheFields: ["hashWithAiModel"],
  idFields: ["dict_ID"],
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
