import { ObjectId } from "mongodb";
import { COLLECTIONS } from "../utils/constants";
import { CreatedAtField, DbHelper } from "../helpers/db";
import { BrocaTypes } from "../types";

export interface IModel extends CreatedAtField {
  material_ID: ObjectId;
  user_ID: ObjectId;
  feedback: BrocaTypes.Feedback.Feedback;
  seen: boolean;
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.AI_FEEDBACKS,
  createdAtField: true,
  idFields: ["material_ID", "user_ID"],
  indexes: [{ key: { material_ID: 1, seen: 1 } }],
});
