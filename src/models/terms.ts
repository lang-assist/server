import { CreatedAtField, DbHelper } from "../helpers/db";
import { LinguisticUnitSet } from "../utils/types";

interface IModel extends CreatedAtField {
  hash: string;
  data: LinguisticUnitSet;
  resolvedBy: string;
}

const Model = DbHelper.model<IModel>({
  collectionName: "terms",
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
