import { ObjectId } from "mongodb";
import { DbHelper, TimeFields } from "../helpers/db";
import { BrocaTypes } from "../types";
import { COLLECTIONS } from "../utils/constants";

export interface IModel extends TimeFields {
  user_ID: ObjectId;
  journey_ID: ObjectId;
  part_ID: ObjectId;
  genStatus: "NOT_STARTED" | "GENERATING" | "GENERATED" | "ERROR";

  explanations?: BrocaTypes.Documentation.Explanation[];
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.DOCS,
  createdAtField: true,
  updatedAtField: true,
});
