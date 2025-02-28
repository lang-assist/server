import { ObjectId } from "mongodb";
import { COLLECTIONS } from "../utils/constants";
import { DbHelper } from "../helpers/db";

interface IModel {
  user_ID: ObjectId;
  journey_ID: ObjectId;
  path_ID: ObjectId;
  material_ID: ObjectId;
  usage: {
    input: number;
    output: number;
    cachedInput: number;
    cacheWrite?: number;
  };
  costs: {
    input: number;
    output: number;
    cachedInput: number;
    cacheWrite?: number;
  };
  total: number;
  withOneDollar: number;
  purpose: string;
}

const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.USAGES,
  cacheById: false,
  idFields: ["user_ID", "journey_ID", "path_ID", "material_ID"],
});

export { Model, IModel };
