import { fal } from "@fal-ai/client";
import { AIModel } from "../../../types/ctx";
import { ImageGeneration } from "./base";
import { BrocaTypes } from "../../../types";

export class FalImgGen extends AIModel<
  ImageGeneration,
  {
    buffer: Buffer;
    contentType: string;
  }
> {
  maxTries: number = 1;
  concurrency: number = 10;

  constructor(public readonly name: string, forOneDollar: number) {
    super("img", {
      per: 1,
      input: 0,
      output: 1 / forOneDollar,
    });
    fal.config({
      credentials: process.env.FAL_API_KEY!,
    });
  }

  async _init(): Promise<void> {}

  async _generate(gen: ImageGeneration): Promise<
    BrocaTypes.AI.GenerationResponse<{
      buffer: Buffer;
      contentType: string;
    }>
  > {
    const res = await fal.subscribe(this.name, {
      input: {
        prompt: gen.prompt,
      },
    });

    if (!res.data) {
      throw new Error("Failed to generate image");
    }

    if (!res.data.images || res.data.images.length === 0) {
      throw new Error("Failed to generate image");
    }

    const image = res.data.images[0];

    const url = image.url;

    if (!url) {
      throw new Error("Failed to generate image");
    }

    const buffer = await fetch(image.url).then((res) => res.arrayBuffer());

    return {
      res: {
        buffer: Buffer.from(buffer),
        contentType: image.content_type,
      },
      usage: {
        input: 0,
        output: 1,
      },
      error: undefined,
    };
  }
}
