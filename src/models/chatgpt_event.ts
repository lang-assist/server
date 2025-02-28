import { CreatedAtField, DbHelper } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";

interface IModel extends CreatedAtField {
  data: any;
}

const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.CHATGPT_EVENTS,
  cacheById: false,
  createdAtField: true,
});

export { Model, IModel };
