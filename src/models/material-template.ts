import { DbHelper } from "../helpers/db";
import { AIModels } from "../utils/ai-types";
import {
  MaterialDetails,
  MaterialMetadata,
  SupportedLanguage,
} from "../utils/types";

export interface IModel {
  aiModel: AIModels;
  language: SupportedLanguage;
  details: MaterialDetails;
  metadata: MaterialMetadata;
}

export const Model = DbHelper.model<IModel>({
  collectionName: "material_templates",
  cacheById: true,
  createdAtField: true,
  updatedAtField: true,
  indexes: [
    {
      key: {
        aiModel: 1,
        language: 1,
      },
    },
  ],
});
