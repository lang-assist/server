import { CreatedAtField, DbHelper } from "../helpers/db";

interface IModel extends CreatedAtField {
  data: any;
}

const Model = DbHelper.model<IModel>({
  collectionName: "chatgpt_events",
  cacheById: false,
  createdAtField: true,
});

export { Model, IModel };
