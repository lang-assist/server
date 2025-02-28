import { BaseMaterialTypeHelper } from "./base";
import { AnswerContext, MaterialGenerationContext } from "../ctx";
import { BrocaTypes } from "../../../../types";
import { msg } from "../../../../utils/prompter";
import { ConversationManager } from "../conversation";
import { WithId } from "mongodb";
import { ConversationTurn, IUserAnswer } from "../../../../models/_index";
import { removeSSML } from "../../../../utils/remove-ssml";

export class ConversationMaterialTypeHelper extends BaseMaterialTypeHelper {
  _describeDetails(
    details: BrocaTypes.Material.Conversation.ConversationDetails
  ): string {
    const instMsg = msg();

    instMsg.addKv("Scenario", details.scenarioScaffold);

    instMsg.addKv("User Instruction", details.instructions);

    instMsg.addKv("Estimated Turn Count", details.length);

    const voices = details.voices;

    if (!voices) {
      throw new Error("No voices found. First prepare details.");
    }

    const charInsts = Object.entries(voices).map(([character, voiceInfo]) => {
      const char = details.characters.find((c) => c.name === character);

      if (!char) {
        throw new Error("Character not found");
      }

      return {
        char: char.name,
        inst: voiceInfo.instructions,
      };
    });

    const charInstsMsg = msg(
      "We will use the following voices for the characters in the conversation:"
    );

    for (const charInst of charInsts) {
      charInstsMsg.addKv(charInst.char, charInst.inst);
    }

    instMsg.add(charInstsMsg.build());

    return instMsg.build();
  }

  _describeAnswer(answer: WithId<IUserAnswer>): string {
    return answer.answers;
  }

  async _prepareAnswer(ctx: AnswerContext): Promise<any> {
    const turns = await ConversationTurn.find({
      material_ID: ctx.material._id,
    });

    const turnsMsg = msg("The conversation turns are:");

    for (const turn of turns) {
      if (turn.analyze) {
        turnsMsg.addKv(turn.character, (m) => {
          m.addKv("Transcribed Text", turn.text);
          m.addKv("Analyze", (anl) => {
            for (const [key, value] of Object.entries(turn.analyze!)) {
              anl.addKv(key, value);
            }
          });
        });
      } else {
        turnsMsg.addKv(turn.character, removeSSML(turn.text));
      }
    }

    return turnsMsg.build();
  }

  constructor() {
    super("CONVERSATION");
  }

  prepareDetails(
    ctx: MaterialGenerationContext,
    details: BrocaTypes.Material.Conversation.ConversationDetails
  ): {
    details: BrocaTypes.Material.MaterialDetails;
    promises: Promise<any>[];
  } {
    const promises: Promise<any>[] = [];

    const characters = details.characters;

    const newCharacters = characters.map((c) => {
      if (c.name === "$user") {
        return c;
      }

      const g = this.generateItemPicture(ctx, c.avatarPrompt, {
        reason: "conversationCharacterAvatar",
      });

      promises.push(g.promise);

      return {
        ...c,
        avatar: g.id,
      };
    });

    (
      details as BrocaTypes.Material.Conversation.ConversationDetails
    ).characters = newCharacters;

    if (ctx.requiredMaterial.material) {
      promises.push(
        ConversationManager.prepareConversationDetails(
          ctx.requiredMaterial.material,
          ctx.flow.user
        )
      );
    }

    return {
      details,
      promises,
    };
  }

  // async postAnswer(
  //   gen: Generation<MaterialGenerationContext, "material">
  // ): Promise<void> {
  //   return;
  // }
}
