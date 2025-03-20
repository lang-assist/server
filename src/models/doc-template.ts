import { DbHelper, ObjectId, TimeFields } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";
import { BrocaTypes } from "../types";
export interface IModel extends TimeFields {
  aiModel: string;
  language: string;
  global: boolean;
  journey_ID?: ObjectId;
  part_ID?: ObjectId;
  user_ID?: ObjectId;

  // ai generated
  title: string;
  description: string;
  explanations: BrocaTypes.Documentation.Explanation[];
  includes: string[];
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.DOC_TEMPLATES,
  cacheById: false,
  createdAtField: true,
  updatedAtField: true,
  indexes: [
    {
      key: {
        language: 1,
        aiModel: 1,
      },
    },
  ],
});
