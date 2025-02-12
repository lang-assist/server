import { Journey, Terms } from "../models/_index";
import { LinguisticUnitSet } from "../utils/types";
import crypto from "crypto";
import { AIModel } from "./ai";
import { ObjectId } from "mongodb";

export class TermManager {
  private static resolving: {
    [key: string]: Promise<LinguisticUnitSet> | undefined;
  } = {};

  private static hash(text: string): string {
    const hs = crypto.createHash("md5").update(text).digest("hex");
    return hs;
  }

  public static async resolve(
    text: string,
    journeyId: ObjectId
  ): Promise<LinguisticUnitSet> {
    const hash = this.hash(text);
    if (this.resolving[hash]) {
      return this.resolving[hash];
    }

    const existing = await Terms.findOne({
      hash,
    });

    if (existing) {
      return existing.data;
    }

    const promise = new Promise<LinguisticUnitSet>(async (resolve, reject) => {
      try {
        const journey = await Journey.findById(journeyId);
        if (!journey) {
          throw new Error("Journey not found");
        }
        const units = await AIModel.resolveLinguisticUnits(text, journey);
        await Terms.insertOne({
          hash,
          data: units,
        });
        resolve(units);
      } catch (e) {
        reject(e);
      }
    }).finally(() => {
      delete this.resolving[hash];
    });

    this.resolving[hash] = promise;
    return promise;
  }

  public static async get(text: string): Promise<string> {
    const hash = this.hash(text);
    const existing = await Terms.findOne({
      hash,
    });
    if (existing) {
      return JSON.stringify(existing.data);
    }
    return JSON.stringify(text);
  }
}
