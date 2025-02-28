import { DbHelper, ObjectId, TimeFields } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";
import { BrocaTypes } from "../types";
export interface IModel extends TimeFields {
  aiModel: string;
  title: string;
  description: string;
  language: string;
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
