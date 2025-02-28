import { CreatedAtField, DbHelper } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";
import { BrocaTypes } from "../types";

interface IModel extends CreatedAtField {
  hash: string;
  data: BrocaTypes.LinguisticUnits.LinguisticUnitSet;
  resolvedBy: string;
}

const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.TERMS,
  cacheById: false,
  queryCacheFields: ["hash"],
  indexes: [
    {
      key: {
        hash: 1,
      },
      unique: true,
    },
  ],
});

export { Model, IModel };
