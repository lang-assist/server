import { DbHelper } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";
import { BrocaTypes } from "../types";
interface IModel {
  language: string;
  materials: BrocaTypes.Material.Material[]; // material template ids
  aiModel: string;
  embeddingModel: string;
  imageGenModel: string;
  level: 3 | 2 | 1;
}

const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.INITIAL_TEMPLATES,
  indexes: [
    {
      key: {
        locale: 1,
        level: 1,
        aiModel: 1,
      },
      unique: true,
    },
  ],
});

export { Model, IModel };
