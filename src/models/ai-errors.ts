import { CreatedAtField, DbHelper } from "../helpers/db";

interface IModel extends CreatedAtField {
  model: string;
  errors: any;
  tries: number;
}

const Model = DbHelper.model<IModel>({
  collectionName: "ai_errors",
  createdAtField: true,
  cacheById: false,
});

export { Model, IModel };
