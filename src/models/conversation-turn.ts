import { CreatedAtField, DbHelper, ObjectId } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";

interface IModel extends CreatedAtField {
  character: string;
  text: string;
  ssml?: string;
  audio_ID?: ObjectId;
  audioError?: Error;
  nextTurn?: string | null;
  analyze?: {
    [key: string]: string;
  };
  material_ID: ObjectId;
}

const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.CONVERSATION_TURNS,
  cacheById: false,
  createdAtField: true,
  idFields: ["material_ID", "audio_ID"],
  indexes: [
    {
      key: {
        material_ID: 1,
      },
    },
  ],
});

export { Model, IModel };
