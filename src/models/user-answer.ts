import { CreatedAtField, DbHelper, ObjectId } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";

interface IModel extends CreatedAtField {
  material_ID: ObjectId;
  user_ID: ObjectId;
  answers: any;
}

const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.USER_ANSWERS,
  idFields: ["material_ID", "user_ID"],
  createdAtField: true,
  cacheById: false,
  indexes: [
    {
      key: { material_ID: 1, user_ID: 1 },
    },
  ],
});

export { Model, IModel };
