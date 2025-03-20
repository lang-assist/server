import { DbHelper } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";

export interface IModel {
  tag: string; // en_US, tr_TR, etc.
  name: string; // (Native) English, Türkçe, etc.

  englishName: string; // English, Turkish, etc.

  direction: "ltr" | "rtl"; // left to right, right to left

  // Initial testte seslendirme için örnek cümleler. 3-7 kelimeden oluşan cümleler.
  // Her dil için 10-20 tane cümle yeterli.
  sentences_to_voice: string[];

  // Initial testte çevirme için örnek cümleler. 3-7 kelimeden oluşan cümleler.
  // Her dil için 10-20 tane cümle yeterli.
  sentences_to_translate: string[];

  country?: string; // US, Saudi Arabia, etc.
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.SUPPORTED_LANGUAGES, // supported_languages
  indexes: [
    {
      key: {
        tag: 1,
      },
      unique: true,
    },
  ],
});
