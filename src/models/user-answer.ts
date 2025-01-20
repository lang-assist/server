import { CreatedAtField, DbHelper, ObjectId } from "../helpers/db";

interface IModel extends CreatedAtField {
  material_ID: ObjectId;
  user_ID: ObjectId;
  path_ID: ObjectId;
  answers: any;
}

const Model = DbHelper.model<IModel>({
  collectionName: "user_answers",
  idFields: ["material_ID", "user_ID", "path_ID"],
  createdAtField: true,
  cacheById: false,
  indexes: [
    {
      key: { material_ID: 1, user_ID: 1, path_ID: 1 },
      unique: true,
    },
  ],
});

export { Model, IModel };
