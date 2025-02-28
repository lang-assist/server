import { CreatedAtField, DbHelper } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";
import { ObjectId } from "mongodb";

export interface IModel extends CreatedAtField {
  genId: string;
  [key: string]: any;
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.PROMPTS,
  createdAtField: true,
  idFields: [],
});
