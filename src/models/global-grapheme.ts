import { CreatedAtField, DbHelper } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";

export interface IModel extends CreatedAtField {
  grapheme: string;
  language: string;
  aiModel: string;
  genStatus: "CREATING" | "GENERATED" | "FAILED";

  // for example, for grapheme "th", there will be /ð/ (the) and /θ/ (think)
  use_cases?: {
    example_words: {
      // tomato, thursday, this, that, etc.
      word: string; // example word containing the grapheme with the rules

      // e.g. for tomato, the pronunciation is /ˈtæmətoʊ/
      pronunciation: string; // ipa pronunciation of the word
    }[]; // example words containing the grapheme with the rules
    rules: string; // rules for the grapheme, e.g. "Starts a word", "Ends a word", "Can be followed by a vowel", "Cannot be followed by a consonant"

    // e.g. /ð/ , /θ/
    pronunciation: string; // ipa
    voiceId?: string; // voice id for the pronunciation. AI not give this.
  }[];
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.GLOBAL_GRAPHEMES,
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
