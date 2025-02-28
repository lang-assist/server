import { CreatedAtField, DbHelper } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";

interface IModel extends CreatedAtField {
  model: string;
  errors: any;
  tries: number;
}

const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.AI_ERRORS,
  createdAtField: true,
  cacheById: false,
});

export { Model, IModel };
