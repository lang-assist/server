import { CreatedAtField, DbHelper, ObjectId } from "../helpers/db";

interface IModel extends CreatedAtField {
  character: string;
  text: string;
  ssml?: string;
  audio_ID?: ObjectId;
  audioError?: Error;
  nextTurn?: string | null;
  analyze?: JSON;
  material_ID: ObjectId;
}

const Model = DbHelper.model<IModel>({
  collectionName: "conversation_turns",
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
