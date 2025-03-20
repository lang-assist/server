import { CreatedAtField, DbHelper } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";

export interface IModel extends CreatedAtField {
  data: any;
  json: any;
  text: string;
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.AZURE_RESULTS,
  createdAtField: true,
});
