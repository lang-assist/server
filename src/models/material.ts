import { ObjectId } from "mongodb";

import { DbHelper, TimeFields } from "../helpers/db";
import {
  MaterialStatus,
  MaterialDetails,
  MaterialMetadata,
} from "../utils/types";

interface IModel extends TimeFields {
  user_ID: ObjectId;
  journey_ID: ObjectId;
  path_ID: ObjectId;
  status: MaterialStatus;
  details: MaterialDetails;
  metadata: MaterialMetadata;
  step: number;
  assistantId?: string;
  threadId?: string;
  instructions?: string;
  preparing?: boolean;
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
  ],
});

export { Model, IModel };
