import { AIImageGenerator } from "./base";
import { fal } from "@fal-ai/client";

export class FalImageGenerator extends AIImageGenerator {
  constructor(public readonly name: string) {
    super();
    fal.config({
      credentials: process.env.FAL_API_KEY!,
    });
  }

  async _init(): Promise<void> {}

  async _generateItemPicture(
    prompt: string
  ): Promise<{ data: Buffer; contentType: string }> {
    const res = await fal.subscribe(this.name, {
      input: {
        prompt,
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
      data: Buffer.from(buffer),
      contentType: image.content_type,
    };
  }
}
