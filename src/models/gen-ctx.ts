import { DbHelper, TimeFields } from "../helpers/db";
import { COLLECTIONS } from "../utils/constants";
import { BrocaTypes } from "../types";
import { AIError } from "../utils/ai-types";

export interface IModel extends TimeFields {
  data: {
    [key: string]: any;
  };

  status: string;

  errors: AIError[];

  usages: {
    usage: BrocaTypes.AI.Types.AIUsage;
    costs: BrocaTypes.AI.Types.AIUsage;
    total: number;
    genType: string;
  }[];

  totalCosts: {
    [key: string]: number;
  };

  total: number;
}

export const Model = DbHelper.model<IModel>({
  collectionName: COLLECTIONS.GEN_CTXES,
  cacheById: false,
  createdAtField: true,
  updatedAtField: true,
});
