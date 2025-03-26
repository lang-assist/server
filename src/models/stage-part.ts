import { CreatedAtField, DbHelper, ObjectId } from "../helpers/db";
import { BrocaTypes } from "../types";
import { COLLECTIONS } from "../utils/constants";

interface IModel extends CreatedAtField {
  stage_ID: ObjectId;
  hidden: boolean;

  type: "TEST" | "DOCUMENTATION" | "SENTENCES" | "WORDS" | "GRAPHEMES";
  explanation: string;

  // for task
  successRate: number | null;

  material: {
    type: BrocaTypes.Material.MaterialType;
    material_ID?: ObjectId;
    improves: string[];
    measures: string[];
    instructions: string;
  };

  documentation: {
    ref_ID?: ObjectId;
    title: string;
    instructions: string;
  };

  // for dictionary
  words: {
    word: string;
    category?: string;
    ref_ID?: ObjectId; // ObjectId of UserDoc
    practices?: string[]; // ObjectIds of Materials
    use_cases?: string[]; // ObjectIds of UserDocs
  }[];

  // for sentences
  sentences: {
    sentence: string;
    context: string;
    ref_ID?: ObjectId;
    practices?: string[]; // ObjectIds of Materials
    use_cases?: string[]; // ObjectIds of UserDocs
  }[];

  // for graphemes
  graphemes: {
    grapheme: string;
    ref_ID?: ObjectId;
    practices?: string[]; // ObjectIds of Materials
    use_cases?: string[]; // ObjectIds of UserDocs
  }[];
}

const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.STAGE_PARTS,
  cacheById: false,
  createdAtField: true,
  indexes: [
    {
      key: {
        stage_ID: 1,
        hidden: 1,
        createdAt: 1,
      },
      name: "stage_ID_hidden_createdAt",
    },
  ],
});

export { Model, IModel };
