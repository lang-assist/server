import { ObjectId } from "mongodb";
import { DbHelper } from "../helpers/db";

interface IModel {
  user_ID: ObjectId;
  journey_ID: ObjectId;
  path_ID: ObjectId;
  usage: any;
  [key: string]: any;
}

const Model = DbHelper.model<IModel>({
  collectionName: "usages",
  cacheById: false,
  idFields: ["user_ID", "journey_ID", "path_ID"],
});

export { Model, IModel };
