import { ObjectId } from "mongodb";
import { Generation, GenerationContext, GenType } from "../../../types/ctx";
import { StorageService } from "../../storage";
import { PictureHelper } from "../../picture_helper";

export class ImageGeneration extends Generation<{
  buffer: Buffer;
  contentType: string;
}> {
  constructor(
    public prompt: string,
    public fileId: ObjectId,
    ctx: GenerationContext,
    meta: {
      reason: string;
      produced: ObjectId;
      [key: string]: any;
    }
  ) {
    super(ctx, meta);
  }

  get genType(): GenType {
    return "img";
  }

  async generate(): Promise<{
    buffer: Buffer;
    contentType: string;
  }> {
    const id = this.fileId.toHexString();

    if (PictureHelper.getGen(id)) {
      return PictureHelper.getGen(id)!;
    }

    const gen = new Promise<{
      buffer: Buffer;
      contentType: string;
    }>(async (resolve, reject) => {
      try {
        const data = await super.generate();

        await StorageService.uploadItemPicture({
          buffer: data.buffer,
          mimeType: data.contentType,
          prompt: this.prompt,
          id: this.fileId,
        });

        resolve(data);
      } catch (error) {
        reject(error);
      }
    });

    PictureHelper.addGen(id, gen);

    return gen;
  }
}

// export abstract class ImgGenModel {
//   constructor(public readonly _prices: BrocaTypes.AI.Types.AIPricing) {}

//   abstract readonly name: string;

//   static models: { [key: string]: ImgGenModel } = {};

//   static async init(models: { [key: string]: ImgGenModel }) {
//     this.models = models;
//     for (const key in this.models) {
//       await this.models[key]._init();
//     }
//   }

//   abstract _init(): Promise<void>;

//   abstract _generateItemPicture(prompt: string): Promise<{
//     data: Buffer;
//     contentType: string;
//     usage: BrocaTypes.AI.Types.AIUsage;
//   }>;

//   // static async generateItemPicture(args: {
//   //   prompt: string;
//   //   model?: string;
//   // }): Promise<{
//   //   data: Buffer;
//   //   contentType: string;
//   // }> {
//   //   return this.models[
//   //     args.model ?? "fal-ai/flux/schnell"
//   //   ]._generateItemPicture(args.prompt);
//   // }
// }
