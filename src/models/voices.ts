import { Binary } from "mongodb";
import { COLLECTIONS } from "../utils/constants";
import { DbHelper } from "../helpers/db";

interface IModel {
  shortName: string;
  gender: string;
  locale: string;
  secondaryLocales?: string[];
  styles?: string[];
  personalities?: string[];
  tailoredScenarios?: string[];
  embedding?: number[];
  itemHash?: string;
  globalHash?: string;
}

const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.VOICES,
  cacheById: true,
  excludeCacheFileds: ["embedding"],
  indexes: [
    {
      key: {
        locale: 1,
      },
    },
    {
      key: {
        shortName: 1,
      },
      unique: true,
    },
  ],
});

export { Model, IModel };
