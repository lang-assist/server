import { CreatedAtField, DbHelper, ObjectId } from "../helpers/db";
import { BrocaTypes } from "../types";
import { COLLECTIONS } from "../utils/constants";

interface IModel extends CreatedAtField {
  user_ID: ObjectId;
  journey_ID: ObjectId;
  notes: string[];
  name: string;
  description: string;
  imagePrompt?: string; // AI generated prompt for the image
  imageId?: string; // AI generated image id

  levelsOnStart: BrocaTypes.Progress.PathLevel;
  levelsOnFinish?: BrocaTypes.Progress.PathLevel;

  focusSkills: string[]; // writing, listening etc.
  focusAreas: string[]; // present simple tense etc.
  includedTopics: string[]; // topics included in the stage, daily life, business, kitchen, etc.

  status: "GENERATING" | "GENERATED" | "COMPLETED";
}

const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.STAGES,
  createdAtField: true,
  idFields: ["user_ID", "journey_ID"],
  cacheById: false,
  indexes: [
    {
      key: {
        user_ID: 1,
        journey_ID: 1,
        createdAt: 1,
      },
    },
  ],
});

export { Model, IModel };
