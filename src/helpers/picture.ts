import { ObjectId } from "mongodb";

import { createHash, hash } from "crypto";
import { AIImageGenerator } from "./ai/base";
import { StorageService } from "./storage";

export class PictureHelper {
  static generating: {
    [key: string]: Promise<void> | undefined;
  } = {};

  static async generateItemPicture(args: {
    itemId: ObjectId;
    prompt: string;
  }): Promise<void> {
    const id = args.itemId.toHexString();
    if (this.generating[id]) {
      return this.generating[id]!;
    }

    this.generating[id] = new Promise(async (resolve, reject) => {
      await new Promise((rs, rj) => {
        setTimeout(() => {
          rs(null);
        }, 10000);
      });

      try {
        const imgRes = await AIImageGenerator.generateItemPicture({
          prompt: args.prompt,
          model: "fal-ai/flux/schnell",
        });

        await StorageService.uploadItemPicture({
          buffer: imgRes.data,
          mimeType: imgRes.contentType,
          prompt: args.prompt,
          id: args.itemId,
        });

        resolve();

        delete this.generating[id];
      } catch (error) {
        reject(error);
        delete this.generating[id];
      }
    });

    return this.generating[id]!;
  }
}
