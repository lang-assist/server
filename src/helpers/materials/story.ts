import { BaseMaterialTypeHelper } from "./base";
import {
  MaterialDetails,
  MaterialGenerationContext,
  StoryDetails,
} from "../../utils/types";
import { Generation } from "../ai/base";

export class StoryMaterialTypeHelper extends BaseMaterialTypeHelper {
  constructor() {
    super("STORY");
  }

  async postCreation(
    gen: Generation<MaterialGenerationContext, "material">
  ): Promise<void> {}

  prepareDetails(
    gen: Generation<MaterialGenerationContext, "material">
  ): MaterialDetails {
    const details = gen.context.material!.details as StoryDetails;

    return details;
  }

  async postAnswer(
    gen: Generation<MaterialGenerationContext, "material">
  ): Promise<void> {
    return;
  }
}
