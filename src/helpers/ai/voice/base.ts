import { ObjectId } from "mongodb";
import {
  AIModel,
  Generation,
  GenerationContext,
  GenType,
} from "../../../types/ctx";
import { BrocaTypes, JsonL } from "../../../types";
import { StorageService } from "../../storage";
import { AudioHelper } from "../../audio_helper";

export class SpeechGeneration extends Generation<JsonL.MediaGenerationType> {
  constructor(
    public text: string,
    public fileId: ObjectId,
    public language: string,
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
    return "tts";
  }

  async generate(): Promise<{
    buffer: Buffer;
    contentType: string;
  }> {
    try {
      const id = this.fileId.toHexString();

      if (AudioHelper.getGen(id)) {
        return AudioHelper.getGen(id)!;
      }

      const gen = new Promise<JsonL.MediaGenerationType>(
        async (resolve, reject) => {
          try {
            const res = await super.generate();

            await StorageService.uploadAudio({
              buffer: res.buffer,
              mimeType: res.contentType,
              id: this.fileId,
            });

            resolve(res);
          } catch (error) {
            reject(error);
          }
        }
      );

      AudioHelper.addGen(id, gen);

      return await gen;
    } catch (e) {
      this.ctx.addError(e as Error);
      throw e;
    }
  }
}

export class TranscriptionGeneration extends Generation<JsonL.TranscriptionGenerationType> {
  constructor(
    public audio: Buffer,
    ctx: GenerationContext,
    meta: {
      reason: string;
      [key: string]: any;
    },
    public language: string | "auto"
  ) {
    super(ctx, meta);
  }

  get genType(): GenType {
    return "stt";
  }
}
