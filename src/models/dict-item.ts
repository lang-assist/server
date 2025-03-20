import { ObjectId } from "mongodb";
import { CreatedAtField, DbHelper } from "../helpers/db";
import { BrocaTypes } from "../types";
import { COLLECTIONS } from "../utils/constants";

export interface IModel extends CreatedAtField {
  part_ID: ObjectId;

  index: number;

  genStatus: "NOT_STARTED" | "GENERATING" | "GENERATED" | "ERROR";

  explanations?: BrocaTypes.Documentation.Explanation[];
  use_cases?: string[]; // ObjectIds of Docs
  practices?: string[]; // ObjectIds of Materials
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.DICT_ITEMS,
  createdAtField: true,
  updatedAtField: true,
});
