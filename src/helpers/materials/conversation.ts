import { IMaterial } from "../../models/_index";

import { ObjectId, WithId } from "mongodb";
import { BaseMaterialTypeHelper } from "./base";
import {
  ConversationDetails,
  MaterialDetails,
  MaterialGenerationContext,
} from "../../utils/types";
import { PictureHelper } from "../picture";
import { Generation } from "../ai/base";

export class ConversationMaterialTypeHelper extends BaseMaterialTypeHelper {
  constructor() {
    super("CONVERSATION");
  }

  async postCreation(
    gen: Generation<MaterialGenerationContext, "material">
  ): Promise<void> {}

  prepareDetails(
    gen: Generation<MaterialGenerationContext, "material">
  ): MaterialDetails {
    const details = gen.context.material!.details as ConversationDetails;

    const characters = details.characters;

    const newCharacters = characters.map((c) => {
      if (c.name === "$user") {
        return c;
      }

      const id = new ObjectId();

      PictureHelper.generateItemPicture({
        itemId: id,
        prompt: c.avatarPrompt,
      }).catch(() => {
        return id.toHexString();
      });

      return {
        ...c,
        avatar: id.toHexString(),
      };
    });

    (details as ConversationDetails).characters = newCharacters;

    return details;
  }

  async postAnswer(
    gen: Generation<MaterialGenerationContext, "material">
  ): Promise<void> {
    return;
  }
}
