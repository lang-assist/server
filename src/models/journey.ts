import { ObjectId } from "mongodb";
import { DbHelper, TimeFields } from "../helpers/db";
import { BrocaTypes } from "../types";
import { COLLECTIONS } from "../utils/constants";

interface IModel extends TimeFields {
  user_ID: ObjectId;
  to: string;
  name: string;
  lastStudyDate?: number;
  avatar: string;
  status: "active" | "completed" | "paused";
  chatModel: string;
  imageGenModel: string;
  ttsModel: string;
  sttModel: string;
  progress: BrocaTypes.Progress.PathProgress;
  paths: {
    [key: string]: {
      name: string;
      type: BrocaTypes.Progress.PathType;
      profession?: string;
      isMain: boolean;
      isActive: boolean;
    };
  };
}

const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.JOURNEYS,
  cacheById: true,
  createdAtField: true,
  updatedAtField: true,
  idFields: ["user_ID"],
  indexes: [
    {
      key: { user_ID: 1, status: 1, lastStudyDate: 1 },
    },
  ],
});

export { Model, IModel };
