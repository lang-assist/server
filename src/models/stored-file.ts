import { DbHelper, ObjectId, TimeFields } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";
import { FOLDER_TYPE } from "../utils/constants";

interface _Base {
  mimeType: string;
  dir: FOLDER_TYPE;
  hash: string;
  size: number;
  thumbSize?: number;
  name?: string;
  user?: ObjectId;
  prompt?: string;
}

type IModel = TimeFields & _Base;

const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.STORED_FILES,
  cacheById: true,
  createdAtField: true,
  updatedAtField: true,
  idFields: ["user"],
  indexes: [
    {
      key: {
        user: 1,
      },
      name: "user",
    },
  ],
  queryCacheFields: [],
});

export { Model, IModel };
