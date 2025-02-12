import { ObjectId, WithId } from "mongodb";
import {
  MaterialType,
  MaterialDetails,
  QuizQuestion,
  QuestionItem,
  MaterialMetadata,
} from "../../utils/types";
import { PictureHelper } from "../picture";
import { AudioHelper } from "../audio";
import { randomColor } from "../../utils/random";
import {
  InitialMaterialGenerationContext,
  MaterialGenerationContext,
} from "../material-gen";
import { GenerationContext } from "../ai/base";
import { AIGeneratedMaterialResponse } from "../../utils/ai-types";

export abstract class BaseMaterialTypeHelper {
  constructor(readonly type: MaterialType) {}

  static addHelper(helper: BaseMaterialTypeHelper) {
    this.helpers[helper.type] = helper;
  }

  // @ts-ignore
  static helpers: {
    [key in MaterialType]: BaseMaterialTypeHelper;
  } = {};

  abstract prepareAnswer(
    gen: MaterialGenerationContext,
    answer: any
  ): Promise<any>;

  static prepareInitial(
    ctx: InitialMaterialGenerationContext,
    materials: AIGeneratedMaterialResponse[]
  ): AIGeneratedMaterialResponse[] {
    if (!materials) {
      return [];
    }

    const mats: AIGeneratedMaterialResponse[] = [];

    for (const material of materials) {
      const helper = BaseMaterialTypeHelper.helpers[material.details.type];

      if (!helper) {
        throw new Error(
          `No helper found for material type ${material.details.type}`
        );
      }

      helper.prepareMetadata(material.metadata, ctx);
      helper.prepareDetails(material.details, ctx);

      mats.push(material);
    }

    ctx.complete();

    return mats;
  }

  static async prepare(ctx: MaterialGenerationContext): Promise<void> {
    if (!ctx.generatingMaterial) {
      return;
    }

    const material = ctx.genMaterial;

    if (!material) {
      return;
    }

    const helper = BaseMaterialTypeHelper.helpers[ctx.generatingMaterial.type];

    if (!helper) {
      throw new Error(
        `No helper found for material type ${ctx.generatingMaterial.type}`
      );
    }

    helper.prepareMetadata(material.metadata, ctx);
    helper.prepareDetails(material.details, ctx);

    ctx.updateGeneratingMaterial({
      metadata: material.metadata,
      details: material.details,
      genStatus: "PREPARING",
      compStatus: "NOT_STARTED",
      convStatus: "NOT_STARTED",
    });

    helper
      .postCreation(ctx)
      .then(async () => {
        await ctx.updateGeneratingMaterial({
          genStatus: "COMPLETED",
        });
      })
      .catch(async (e) => {
        await ctx.updateGeneratingMaterial({
          genStatus: "ERROR",
        });
        ctx.addError(e);
      })
      .finally(() => {
        ctx.complete();
      });
  }

  abstract postCreation(ctx: MaterialGenerationContext): Promise<void>;

  abstract prepareDetails(
    details: MaterialDetails,
    ctx: GenerationContext<"material">
  ): MaterialDetails;

  abstract postAnswer(ctx: MaterialGenerationContext): Promise<void>;

  prepareMetadata(
    metadata: MaterialMetadata,
    ctx: GenerationContext<any>
  ): MaterialMetadata {
    metadata.avatar = randomColor();
    return metadata;
  }

  speechAudio(ctx: MaterialGenerationContext, ssml: string) {
    console.log("SPEAKING", ssml);
    const audioId = new ObjectId();
    AudioHelper.speak(ssml, ctx.language, audioId);

    return audioId.toHexString();
  }

  modifyQuestion(
    ctx: MaterialGenerationContext,
    question: QuizQuestion
  ): QuizQuestion {
    question.items = question.items?.map((item) =>
      this.modifyQuestionItem(ctx, item)
    );

    question.choices = question.choices?.map((item) =>
      this.modifyQuestionItem(ctx, item)
    );
    question.secondItems = question.secondItems?.map((item) =>
      this.modifyQuestionItem(ctx, item)
    );

    return question;
  }

  modifyQuestionItem(
    ctx: MaterialGenerationContext,
    item: QuestionItem
  ): QuestionItem {
    if (item.picturePrompt) {
      const id = new ObjectId();
      PictureHelper.generateItemPicture({
        itemId: id,
        prompt: item.picturePrompt,
      });
    }

    return item;
  }
}
