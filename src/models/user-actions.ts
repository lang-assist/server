import { CreatedAtField, DbHelper, ObjectId } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";

export interface IModel extends CreatedAtField {
  stage_ID: ObjectId;
  part_ID: ObjectId;
  behavior: string;
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.USER_ACTIONS,
  createdAtField: true,
  idFields: ["stage_ID", "part_ID"],
});
