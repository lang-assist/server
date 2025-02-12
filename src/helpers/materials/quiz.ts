import { IMaterial } from "../../models/_index";

import { ObjectId, WithId } from "mongodb";
import { BaseMaterialTypeHelper } from "./base";
import {
  MaterialDetails,
  MaterialGenerationContext,
  QuizDetails,
} from "../../utils/types";
import { PictureHelper } from "../picture";
import { Generation } from "../ai/base";

export class QuizMaterialTypeHelper extends BaseMaterialTypeHelper {
  constructor() {
    super("QUIZ");
  }

  async postCreation(
    gen: Generation<MaterialGenerationContext, "material">
  ): Promise<void> {}

  prepareDetails(
    gen: Generation<MaterialGenerationContext, "material">
  ): MaterialDetails {
    const details = gen.context.material!.details as QuizDetails;

    const questions = (details as QuizDetails).questions;

    const newQuestions = questions.map((question) =>
      this.modifyQuestion(gen, question)
    );

    (details as QuizDetails).questions = newQuestions;

    const preludes = (details as QuizDetails).preludes;

    if (preludes && preludes.length > 0) {
      const newPreludes = preludes.map((p) => {
        if (p.parts.length > 0) {
          for (const part of p.parts) {
            if (part.type === "PICTURE" && part.picturePrompt) {
              const id = new ObjectId();
              PictureHelper.generateItemPicture({
                itemId: id,
                prompt: part.picturePrompt!,
              }).catch(() => {
                return id.toHexString();
              });

              part.pictureId = id.toHexString();
            } else if (part.type === "AUDIO" && part.content) {
              part.audioId = this.speechAudio(gen, part.content!);
            }
          }
        }

        return p;
      });

      (details as QuizDetails).preludes = newPreludes;
    }

    return details;
  }

  async postAnswer(): Promise<void> {
    return;
  }
}
