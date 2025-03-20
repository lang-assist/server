import { CreatedAtField, DbHelper } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";

export interface IModel extends CreatedAtField {
  phoneme: string;
  language: string;
  aiModel: string;
  genStatus: "CREATING" | "GENERATED" | "FAILED";
  graphemes?: string[]; // for example, for phoneme /f/, there will be "f", "ph", "gh". It is used to search the graphemes in db.
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.GLOBAL_PHONEMES,
  createdAtField: true,
  indexes: [
    {
      key: {
        grapheme: 1,
        language: 1,
        aiModel: 1,
      },
      unique: true,
    },
  ],
});
