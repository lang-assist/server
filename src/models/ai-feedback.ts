import { ObjectId } from "mongodb";
import { AIFeedbackInterface } from "../utils/ai-types";
import { CreatedAtField, DbHelper } from "../helpers/db";

export interface IModel extends CreatedAtField {
  material_ID: ObjectId;
  user_ID: ObjectId;
  feedback: AIFeedbackInterface;
  seen: boolean;
}

export const Model = DbHelper.model<IModel>({
  collectionName: "ai-feedback",
  createdAtField: true,
  idFields: ["material_ID", "user_ID"],
  indexes: [{ key: { material_ID: 1, seen: 1 } }],
});
