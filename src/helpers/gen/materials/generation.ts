import { ChatGeneration } from "../../ai";
import { undefinedOrValue } from "../../../utils/validators";
import { BaseMaterialTypeHelper } from "./type-helpers";
import { MaterialGenerationContext } from "./ctx";
import { AIError } from "../../../utils/ai-types";
import { settlePromises } from "../../../utils/constants";

// export class MaterialGenStep extends GenerationStep<
//   MaterialGenContext,
//   BrocaTypes.AI.Types.MaterialGenerationResponse
// > {
//   constructor(public type: BrocaTypes.Material.MaterialType) {
//     super();
//   }

//   getGeneration(
//     flow: GenerationFlow<MaterialGenContext>
//   ): Generation<BrocaTypes.AI.Types.MaterialGenerationResponse> {
//     const builder = new PromptBuilder();

//     return new ChatGeneration("material", flow.ctx.journey.aiModel, builder);
//   }

//   async handle(
//     flow: GenerationFlow<MaterialGenContext>,
//     res: BrocaTypes.AI.Types.MaterialGenerationResponse
//   ): Promise<{
//     next?: GenerationStep<MaterialGenContext, any> | undefined;
//     newStatus?: GenerationStatus;
//   }> {
//     const preparingSteps: GenerationStep<MaterialGenContext, any>[] = [];

//     const prepRes = BaseMaterialTypeHelper.prepare(this.type, res.material);

//     const steps = prepRes.steps;
//     const details = prepRes.details;

//     preparingSteps.push(...steps);

//     await flow.ctx.setDetails(this.type, details);

//     return {
//       newStatus: "PROCESSING",
//     };
//   }
// }

export class MaterialGenerationHelper {
  static generatingMaterials: {
    [key: string]: MaterialGenerationContext;
  } = {};

  static async gen(ctx: MaterialGenerationContext): Promise<void> {
    const materialId = ctx.requiredMaterial._id.toString();

    if (this.generatingMaterials[materialId]) {
      await this.generatingMaterials[materialId].waitUntil("generated");
      return;
    }

    this.generatingMaterials[materialId] = ctx;

    try {
      ctx.startGeneration();

      const prompt = await ctx.getGenerationPrompt(ctx.requiredMaterial.type);

      const aiRes = await new ChatGeneration(
        ctx.type as "quiz" | "story" | "conversation",
        prompt,
        ctx
      ).generate();

      ctx.rawResponse = aiRes;

      const details = undefinedOrValue(aiRes.details, null);

      if (!details) {
        throw new Error("Material not found");
      }

      const prepRes = BaseMaterialTypeHelper.prepare(ctx, details);

      await ctx.setDetails(prepRes.details);

      ctx.addPostGen(...prepRes.promises);

      await ctx.complete();

      await ctx._updateMaterial({
        genStatus: "COMPLETED",
      });
    } catch (e) {
      ctx.addError(e as Error);
      throw e;
    } finally {
      delete this.generatingMaterials[materialId];
    }
  }
}
