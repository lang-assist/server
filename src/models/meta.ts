import { DbHelper } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";

interface IModel {
  name: string;
  [key: string]: any;
}

const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.METAS,
  createdAtField: false,
  updatedAtField: false,
  cacheById: false,
});

export { Model, IModel };
