import { DbHelper } from "../helpers/db";

export interface IModel {
  [key: string]: any;
}

export const Model = DbHelper.model<IModel>({
  collectionName: "generations",
  cacheById: false,
});
