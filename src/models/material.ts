import { ObjectId } from "mongodb";

import { DbHelper, TimeFields } from "../helpers/db";
import { MaterialDetails, MaterialMetadata } from "../utils/types";

interface IModel extends TimeFields {
  user_ID: ObjectId;
  journey_ID: ObjectId;
  path_ID: ObjectId;
  genStatus: "CREATING" | "PREPARING" | "COMPLETED" | "ERROR";
  compStatus: "NOT_STARTED" | "COMPLETED" | "ANALYZING" | "ERROR";
  convStatus: "NOT_STARTED" | "COMPLETED" | "PENDING";
  details: MaterialDetails;
  metadata: MaterialMetadata;
  step: number;
  assistantId?: string;
  threadId?: string;
  instructions?: string;
  genId: string;
}

const Model = DbHelper.model<IModel>({
  collectionName: "materials",
  cacheById: false,
  createdAtField: true,
  updatedAtField: true,
  idFields: ["user_ID", "journey_ID", "path_ID"],
  indexes: [
    {
      key: { user_ID: 1, journey_ID: 1, step: 1 },
    },
    {
      key: { genId: 1 },
    },
  ],
});

export { Model, IModel };
