import { MaterialGenerationContext } from "../ctx";
import { AnswerContext } from "../ctx";
import { BaseMaterialTypeHelper } from "./base";
import { BrocaTypes } from "../../../../types";
import { msg } from "../../../../utils/prompter";
import { removeSSML } from "../../../../utils/remove-ssml";
type StoryDetails = BrocaTypes.Material.Story.StoryDetails;

export class StoryMaterialTypeHelper extends BaseMaterialTypeHelper {
  _describeDetails(details: StoryDetails): string {
    const m = msg();

    m.addKv("Parts", (sub) => {
      for (const part of details.parts) {
        if (part.type === "PICTURE") {
          sub.addKv("Picture", part.picturePrompt!);
        } else if (part.type === "QUESTION") {
          const q = part.question as BrocaTypes.Material.Quiz.QuizQuestion;
          sub.addKv(`Question "${q.id}"`, this.describeQuestion(q));
        } else if (part.type === "AUDIO") {
          sub.addKv("Audio", removeSSML(part.ssml!));
        }
      }
    });

    return m.build();
  }
  _describeAnswer(answer: any): string {
    return this.describeQuestionAnswer(answer);
  }
  async _prepareAnswer(ctx: AnswerContext): Promise<any> {
    return await this.prepareQuestionAnswer(ctx);
  }
  constructor() {
    super("STORY");
  }

  prepareDetails(
    ctx: MaterialGenerationContext,
    details: StoryDetails
  ): {
    details: StoryDetails;
    promises: Promise<any>[];
  } {
    const promises: Promise<any>[] = [];

    const det = details as StoryDetails;

    const newParts: BrocaTypes.Material.Story.StoryPart[] = [];

    for (const part of det.parts) {
      if (part.type === "PICTURE" && part.picturePrompt) {
        const img = this.generateItemPicture(ctx, part.picturePrompt, {
          reason: "storyPartPicture",
        });
        part.pictureId = img.id;
        promises.push(img.promise);

        newParts.push(part);
      } else if (part.type === "AUDIO" && part.ssml) {
        const audio = this.speechAudio(ctx, part.ssml!, {
          reason: "storyPartAudio",
        });
        part.audioId = audio.audioId;
        promises.push(audio.promise);

        newParts.push(part);
      } else if (part.type === "QUESTION") {
        const mod = this.modifyQuestion(
          ctx,
          (part.question as BrocaTypes.Material.Quiz.QuizQuestion)!
        );
        promises.push(...mod.promises);

        part.question = mod.question;
        newParts.push(part);
      } else {
        throw new Error(`Unknown part type: ${part.type}`);
      }
    }

    det.parts = newParts;

    return {
      details: det,
      promises,
    };
  }
}
