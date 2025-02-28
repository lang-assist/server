import { IJourney, Journey, Terms } from "../../models/_index";
import crypto from "crypto";
import { ObjectId, WithId } from "mongodb";
import { BrocaTypes } from "../../types";
import { GenerationContext } from "../../types/ctx";
import {
  ChatGeneration,
  ChatGenerationContextWithGlobalAssistant,
} from "../ai/chat/base";
import { msg, PromptBuilder } from "../../utils/prompter";
import { AIModels } from "../../utils/constants";
import { instructions } from "../prompts";

class LinguisticUnitsCtx extends ChatGenerationContextWithGlobalAssistant {
  public linguisticUnits: BrocaTypes.LinguisticUnits.LinguisticUnitSet | null =
    null;

  toJSON() {
    return {
      ...super.toJSON(),
      linguisticUnits: this.linguisticUnits,
      text: this.text,
    };
  }
  public get language(): string {
    return this.journey.to;
  }

  public get chatModel(): keyof typeof AIModels.chat {
    return this.journey.chatModel! as keyof typeof AIModels.chat;
  }

  public get ttsModel(): keyof typeof AIModels.tts {
    return this.journey.ttsModel! as keyof typeof AIModels.tts;
  }

  public get imgModel(): keyof typeof AIModels.img {
    return this.journey.imageGenModel! as keyof typeof AIModels.img;
  }

  public constructor(
    public readonly journey: WithId<IJourney>,
    public text: string
  ) {
    super("linguisticUnits", "linguisticUnits");
  }
}
export class TermManager {
  private static resolving: {
    [key: string]: LinguisticUnitsCtx;
  } = {};

  private static hash(text: string): string {
    const hs = crypto.createHash("md5").update(text).digest("hex");
    return hs;
  }

  public static async resolve(
    text: string,
    journeyId: ObjectId
  ): Promise<BrocaTypes.LinguisticUnits.LinguisticUnitSet> {
    const hash = this.hash(text);
    if (this.resolving[hash]) {
      await this.resolving[hash].waitUntil("completed");
      return this.resolving[hash].linguisticUnits!;
    }

    const existing = await Terms.findOne({
      hash,
    });

    if (existing) {
      return existing.data;
    }

    const journey = await Journey.findById(journeyId);
    if (!journey) {
      throw new Error("Journey not found");
    }

    try {
      const ctx = new LinguisticUnitsCtx(journey, text);

      const builder = new PromptBuilder({
        userName: "user",
        language: journey.to,
      });

      builder.systemMessage(
        instructions.linguistic_units.content,
        "assistant",
        1
      );

      builder.userMessage(
        msg(`Resolve the following text into linguistic units:\n'${text}'`)
      );

      const gen = new ChatGeneration("linguisticUnits", builder, ctx);

      ctx.startGeneration();

      const aiResult = await gen.generate();

      await Terms.insertOne({
        hash,
        data: aiResult.result,
      });

      await ctx.complete();

      return aiResult.result;
    } catch (e) {
      throw e;
    } finally {
      delete this.resolving[hash];
    }
  }

  public static async get(text: string): Promise<string> {
    const hash = this.hash(text);
    const existing = await Terms.findOne({
      hash,
    });
    if (existing) {
      return JSON.stringify(existing.data);
    }
    return JSON.stringify(text);
  }
}
