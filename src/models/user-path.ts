import { ObjectId } from "mongodb";
import { DbHelper, TimeFields } from "../helpers/db";
import { PathProgress } from "../utils/types/path";
import { PathType } from "../utils/types/path";

interface IModel extends TimeFields {
  user_ID: ObjectId;
  journey_ID: ObjectId;
  name: string;
  description?: string;
  isActive: boolean;
  isMain: boolean;
  lastStudyDate?: number;
  type: PathType;
  progress: PathProgress;
  threadId?: string;
  profession?: string;
  stage?: "0" | "1" | "2";
  initialLevel?: 3 | 2 | 1;
}

const Model = DbHelper.model<IModel>({
  collectionName: "user_paths",
  cacheById: true,
  createdAtField: true,
  updatedAtField: true,
  idFields: ["user_ID", "journey_ID"],
  indexes: [
    {
      key: { user_ID: 1, journey_ID: 1 },
    },
  ],
});

export { Model, IModel };
