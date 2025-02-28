import { DbHelper } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";

export interface IModel {
  [key: string]: any;
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.GENERATION_ENTRIES,
  cacheById: false,
});
