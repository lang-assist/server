import { DbHelper, TimeFields } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";
import { BrocaTypes } from "../types";
export interface IModel extends TimeFields {
  chatModel: string;
  language: string;
  entry: BrocaTypes.Dictionary.DictionaryEntry;
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.DICT_TEMPLATES,
  cacheById: false,
  createdAtField: true,
  updatedAtField: true,
  indexes: [
    {
      key: {
        language: 1,
        chatModel: 1,
      },
    },
  ],
});
