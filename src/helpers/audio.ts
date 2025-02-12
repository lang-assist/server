import { ObjectId } from "mongodb";

import { StorageService } from "./storage";
import { AzureVoice } from "./voice/azure";
import { ConversationTurn } from "../models/_index";

export class AudioHelper {
  static generating: {
    [key: string]: Promise<void> | undefined;
  } = {};

  static async speak(
    ssml: string,
    language: string,
    audioId: ObjectId
  ): Promise<void> {
    const id = audioId.toHexString();
    if (this.generating[id]) {
      return this.generating[id]!;
    }

    this.generating[id] = new Promise(async (resolve, reject) => {
      try {
        const buffer = await AzureVoice.speak(ssml, language);

        await StorageService.uploadAudio({
          buffer,
          mimeType: "audio/wav",
          id: audioId,
        });

        resolve();

        delete this.generating[id];
      } catch (error) {
        delete this.generating[id];
        resolve();
      }
    });

    return this.generating[id]!;
  }

  static async generateAudio(args: {
    turnId: ObjectId;
    audioId: ObjectId;
    ssml: string;
    language: string;
  }): Promise<void> {
    const id = args.audioId.toHexString();
    if (this.generating[id]) {
      return this.generating[id]!;
    }

    this.generating[id] = new Promise(async (resolve, reject) => {
      try {
        const buffer = await AzureVoice.speak(args.ssml, args.language);

        await StorageService.uploadAudio({
          buffer,
          mimeType: "audio/wav",
          id: args.audioId,
        });

        resolve();

        delete this.generating[id];
      } catch (error) {
        await ConversationTurn.findByIdAndUpdate(args.turnId, {
          $set: {
            audioError: new Error(
              "Failed to generate audio. " + ((error as Error).stack ?? "")
            ),
          },
        });
        delete this.generating[id];
        resolve();
      }
    });

    return this.generating[id]!;
  }
}
