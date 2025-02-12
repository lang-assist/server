import { DbHelper } from "../helpers/db";
import { AIGeneratedMaterialResponse } from "../utils/ai-types";
import { SupportedLocale } from "../utils/types";

interface IModel {
  locale: SupportedLocale;
  materials: AIGeneratedMaterialResponse[]; // material template ids
  aiModel: string;
  level: 3 | 2 | 1;
}

const Model = DbHelper.model<IModel>({
  collectionName: "initial-templates",
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
