import { ObjectId } from "mongodb";
import { DbHelper, TimeFields } from "../helpers/db";
import { AIModel } from "../helpers/ai";
import { SupportedLocale } from "../utils/types";

interface IModel extends TimeFields {
  user_ID: ObjectId;
  to: SupportedLocale;
  name: string;
  lastStudyDate?: number;
  avatar: string;
  status: "active" | "completed" | "paused";
  aiModel: string;
  assistantId?: string;
  assistantHash?: string;
}

const Model = DbHelper.model<IModel>({
  collectionName: "journeys",
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
