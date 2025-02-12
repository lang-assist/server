import { ObjectId } from "mongodb";
import { DbHelper, TimeFields } from "../helpers/db";
import { SupportedLanguage } from "../utils/types";

interface IModel extends TimeFields {
  user_ID: ObjectId;
  to: SupportedLanguage;
  name: string;
  lastStudyDate?: number;
  avatar: string;
  status: "active" | "completed" | "paused";
  aiModel: string;
  embeddingModel: string;
  imageGenModel: string;
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
