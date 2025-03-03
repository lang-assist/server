import { DbHelper, ObjectId, TimeFields } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";

export interface IModel extends TimeFields {
  template_ID: ObjectId;
  user_ID: ObjectId;
  journey_ID: ObjectId;
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.USER_DOCS,
  cacheById: true,
  createdAtField: true,
  updatedAtField: true,
  idFields: ["template_ID", "user_ID", "journey_ID"],
  indexes: [
    {
      key: {
        user_ID: 1,
        template_ID: 1,
        journey_ID: 1,
      },
      unique: true,
    },
  ],
});
