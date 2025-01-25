import { ChatMessage } from "ai-prompter";
import { CreatedAtField, DbHelper } from "../helpers/db";
import { ObjectId } from "mongodb";

export interface IModel extends CreatedAtField {
  user_ID?: ObjectId;
  journey_ID?: ObjectId;
  path_ID?: ObjectId;
  material_ID?: ObjectId;
  messages: ChatMessage[];
  context?: string;
  purpose: string;
}

export const Model = DbHelper.model<IModel>({
  collectionName: "prompts",
  createdAtField: true,
  idFields: ["user_ID", "journey_ID", "path_ID", "material_ID"],
  validator(data) {
    if (!data.purpose) {
      throw new Error("Purpose is required");
    }
  },
});
