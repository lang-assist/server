import { CreatedAtField, DbHelper, TimeFields } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";
import { ObjectId } from "mongodb";

interface IModel extends CreatedAtField {
  // User ID
  auth: ObjectId;
  code: string;
  verified: boolean;
  reason: "email-v" | "phone-v" | "pwd-v";
  verifiedAt: Date;
  usage: String;
}

const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.VERIFICATIONS,
  createdAtField: true,
  updatedAtField: false,
  cacheById: true,
  idFields: ["auth"],
  indexes: [
    {
      key: { auth: 1 },
      unique: false,
      name: "auth",
    },
  ],
  queryCacheFields: [],
});

export { Model, IModel };
