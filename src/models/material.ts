import { ObjectId } from "mongodb";
import { COLLECTIONS } from "../utils/constants";

import { DbHelper, TimeFields } from "../helpers/db";
import { BrocaTypes } from "../types";

interface IModel extends TimeFields {
  user_ID: ObjectId;
  journey_ID: ObjectId;
  pathID: string; // is not ObjectId
  genStatus: "CREATING" | "PREPARING" | "COMPLETED" | "ERROR";
  compStatus: "NOT_STARTED" | "COMPLETED" | "ANALYZING" | "ERROR";
  convStatus: "NOT_STARTED" | "COMPLETED" | "PENDING";
  feedbackStatus: "NOT_STARTED" | "GENERATING" | "COMPLETED" | "ERROR";
  details: BrocaTypes.Material.MaterialDetails;
  metadata: BrocaTypes.Material.MaterialMetadata;
  assistant?: BrocaTypes.AI.AIAssistant;
  threadId?: string;
  genId: string;
}

const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.MATERIALS,
  cacheById: false,
  createdAtField: true,
  updatedAtField: true,
  idFields: ["user_ID", "journey_ID"],
  indexes: [
    {
      name: "user-journey-path",
      key: { user_ID: 1, journey_ID: 1, pathID: 1 },
    },
    {
      key: { genId: 1 },
    },
  ],
});

export { Model, IModel };
