import { DbHelper } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";

export interface IModel {
  tag: string; // en_US, tr_TR, etc.
  name: string; // (Native) English, Türkçe, etc.
  englishName: string; // English, Turkish, etc.
  direction: "ltr" | "rtl"; // left to right, right to left
  country?: string; // US, Saudi Arabia, etc.
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.SUPPORTED_FROM_LOCALES, // supported_from_locales
  indexes: [
    {
      key: {
        tag: 1,
      },
      unique: true,
    },
  ],
});
