import { BaseMaterialTypeHelper } from "./base";
import { AnswerContext, MaterialGenerationContext } from "../ctx";
import { BrocaTypes } from "../../../../types";
import { msg } from "../../../../utils/prompter";
import { removeSSML } from "../../../../utils/remove-ssml";

type QuizDetails = BrocaTypes.Material.Quiz.QuizDetails;

export class QuizMaterialTypeHelper extends BaseMaterialTypeHelper {
  _describeDetails(details: QuizDetails): string {
    const m = msg();

    const preludes = details.preludes;

    if (preludes && preludes.length > 0) {
      m.addKv("Preludes", (prel) => {
        for (const prelude of preludes) {
          prel.addKv(`Prelude "${prelude.id}"`, (sub) => {
            for (const part of prelude.parts) {
              if (part.type === "PICTURE") {
                sub.addKv("Picture Prompt", part.picturePrompt!);
              } else if (part.type === "TEXT") {
                sub.addKv("Text", part.content!);
              } else if (part.type === "AUDIO") {
                sub.addKv("Audio", removeSSML(part.content!));
              }
            }
          });
        }
      });
    }

    m.addKv("Questions", this.describeQuestions(details.questions));

    return m.build();
  }

  _describeAnswer(answer: BrocaTypes.Material.Quiz.QuizAnswer): string {
    return this.describeQuestionAnswer(answer);
  }

  async _prepareAnswer(ctx: AnswerContext): Promise<any> {
    return this.prepareQuestionAnswer(ctx);
  }

  constructor() {
    super("QUIZ");
  }

  // async postCreation(
  //   gen: Generation<MaterialGenerationContext, "material">
  // ): Promise<void> {}

  prepareDetails(
    ctx: MaterialGenerationContext,
    details: BrocaTypes.Material.MaterialDetails
  ): {
    details: BrocaTypes.Material.MaterialDetails;
    promises: Promise<any>[];
  } {
    const promises: Promise<any>[] = [];

    const det = details as QuizDetails;

    const questions = det.questions;

    const newQuestions = questions.map((question) => {
      const r = this.modifyQuestion(ctx, question);
      promises.push(...r.promises);
      return r.question;
    });

    det.questions = newQuestions;

    const preludes = det.preludes;

    if (preludes && preludes.length > 0) {
      const newPreludes = preludes.map((p) => {
        if (p.parts.length > 0) {
          for (const part of p.parts) {
            if (part.type === "PICTURE" && part.picturePrompt) {
              const img = this.generateItemPicture(ctx, part.picturePrompt, {
                reason: "quizPreludePicture",
              });
              part.pictureId = img.id;
              promises.push(img.promise);
            } else if (part.type === "AUDIO" && part.content) {
              const audio = this.speechAudio(ctx, part.content!, {
                reason: "quizPreludeAudio",
              });
              part.audioId = audio.audioId;
              promises.push(audio.promise);
            }
          }
        }

        return p;
      });

      det.preludes = newPreludes;
    }

    return {
      details: det,
      promises,
    };
  }

  async postAnswer(): Promise<void> {
    return;
  }
}
