import { Binary } from "mongodb";
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
}

const Model = DbHelper.model<IModel>({
  collectionName: "voices",
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
