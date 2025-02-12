import { DbHelper, ObjectId, TimeFields } from "../helpers/db";
import { Explanation } from "../utils/types";

export interface IModel extends TimeFields {
  aiModel: string;
  title: string;
  description: string;
  language: string;
  explanations: Explanation[];
  includes: string[];
}

export const Model = DbHelper.model<IModel>({
  collectionName: "doc-template",
  cacheById: false,
  createdAtField: true,
  updatedAtField: true,
  indexes: [],
});
