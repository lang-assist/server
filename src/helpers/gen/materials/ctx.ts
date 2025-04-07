import {
  Material,
  IUser,
  IUserAnswer,
  IJourney,
  IMaterial,
  UserAnswer,
  Journey,
  IStage,
  IStagePart,
} from "../../../models/_index";

import { WithId } from "mongodb";
import { BrocaTypes } from "../../../types";
import { AIError } from "../../../utils/ai-types";
import {
  MessageBuilder,
  msg,
  PromptBuilder,
  withTag,
} from "../../../utils/prompter";
import { ChatGenerationContextWithGlobalAssistant } from "../../ai/chat/base";
import { AIModels } from "../../../utils/constants";
import {
  additionalInstructions,
  describeMaterialAnswer,
  instructions,
  journeySummary,
  lastStagesSummaries,
  previousBehaviors,
  progressSummary,
  summarizeStageFocus,
} from "../../prompts";
import { VoiceManager } from "../../voice";
import { GenerationContext } from "../../../types/ctx";
import { WithGQLID } from "../../db";
import { LanguageHelper } from "../../language";
import { LocaleHelper } from "../../locale";

// export type MaterialGenSteps =
//   | "ANALYZING" // Analyzing the material
//   | "GENERATING" // Generating the material
//   | "PREPARING" // Preparing the material
//   | "FEEDBACK" // Getting feedback from the answered material
//   | "IMG_GEN" // Generating image for the material
//   | "TTS" // Generating TTS for the material
//   | "STT"; // Transcribing the material

// export type MaterialGenFlow = "FEEDBACK" | "ANALYZE";

export class MaterialFlowContext {
  constructor(args: {
    journey: WithGQLID<IJourney>;
    user: WithGQLID<IUser>;
    rawAnswer?: any;
    answeredMaterial?: WithGQLID<IMaterial>;
    stage: WithGQLID<IStage>;
    part?: WithGQLID<IStagePart>;
  }) {
    this.journey = args.journey;
    this.stage = args.stage;
    this.user = args.user;
    this.rawAnswer = args.rawAnswer;
    this.answeredMaterial = args.answeredMaterial;
    this.part = args.part;
  }

  toJSON() {
    return {
      journeyID: this.journey._id,
      stageID: this.stage._id,
      userID: this.user._id,
      answeredMaterialID: this.answeredMaterial?._id,
      rawAnswer: this.rawAnswer,
      userAnswerID: this.userAnswer?._id,
    };
  }

  public journey: WithGQLID<IJourney>;
  public stage: WithGQLID<IStage>;
  public user: WithGQLID<IUser>;
  public part?: WithGQLID<IStagePart>;

  public answeredMaterial?: WithId<IMaterial>;
  public rawAnswer?: any;
  public userAnswer?: WithId<IUserAnswer>;

  public async updateAnsweredMaterial(updates: Partial<IMaterial>) {
    if (!this.answeredMaterial) {
      throw new Error("Answered material not found");
    }

    const newMaterial = await Material.findByIdAndUpdate(
      this.answeredMaterial._id,
      {
        $set: updates,
      }
    );

    if (!newMaterial) {
      throw new Error("Material not updated");
    }

    this.answeredMaterial = newMaterial;
  }
}

export abstract class MaterialBaseContext extends ChatGenerationContextWithGlobalAssistant {
  constructor(args: {
    flow: MaterialFlowContext;
    type: BrocaTypes.AI.Types.MsgGenerationType;
    reason: string;
  }) {
    super(args.type, args.reason);

    this.flow = args.flow;
  }

  public flow: MaterialFlowContext;

  public get language() {
    return this.flow.journey.to;
  }

  public get chatModel(): keyof typeof AIModels.chat {
    return this.flow.journey.chatModel! as keyof typeof AIModels.chat;
  }

  public get imgModel(): keyof typeof AIModels.img {
    return this.flow.journey.imageGenModel! as keyof typeof AIModels.img;
  }

  public get ttsModel(): keyof typeof AIModels.tts {
    return this.flow.journey.ttsModel! as keyof typeof AIModels.tts;
  }

  public get sttModel(): keyof typeof AIModels.stt {
    return this.flow.journey.sttModel! as keyof typeof AIModels.stt;
  }

  public toJSON() {
    return {
      ...super.toJSON(),
      ...this.flow.toJSON(),
    };
  }
}

export class MaterialGenerationContext extends MaterialBaseContext {
  rawResponse: any | null = null;

  preludes: BrocaTypes.Material.Quiz.QuizPrelude[] = [];
  questions: BrocaTypes.Material.Quiz.QuizQuestion[] = [];
  storyParts: BrocaTypes.Material.Story.StoryPart[] = [];
  conversationDatas: any[] = [];

  toJSON() {
    return {
      ...super.toJSON(),
      requiredMaterial: {
        type: this.requiredMaterial.type,
        material: this.requiredMaterial._id,
        improves: this.requiredMaterial.improves,
        measures: this.requiredMaterial.measures,
        instructionsToAI: this.requiredMaterial.instructions,
      },
    };
  }

  constructor(args: {
    flow: MaterialFlowContext;
    requiredMaterial: WithId<IMaterial>;
    reason: string;
  }) {
    let genType: BrocaTypes.AI.Types.MsgGenerationType;

    switch (args.requiredMaterial.type) {
      case "QUIZ":
        genType = "quiz";
        break;
      case "CONVERSATION":
        genType = "conversation";
        break;
      case "STORY":
        genType = "story";
        break;
      default:
        throw new AIError(
          "Material type not supported: " + args.requiredMaterial.type
        );
    }

    super({
      flow: args.flow,
      reason: args.reason,
      type: genType,
    });

    this.requiredMaterial = args.requiredMaterial;
  }

  public async setCompleted() {
    await this._updateMaterial({
      genStatus: "COMPLETED",
    });
  }

  public requiredMaterial: WithId<IMaterial>;

  /**
   * Requeired instructions:
   *
   * Main Material Gen Instructions
   *
   * Journey Summary
   *
   * Progress Summary
   *
   * Stage Summary
   *
   * AI generated material instructions: improves, measures, instructionsToAI
   *
   */
  public async getGenerationPrompt(type: BrocaTypes.Material.MaterialType) {
    const builder = new PromptBuilder();

    let ins: { content: MessageBuilder; version: number };

    switch (type) {
      case "QUIZ":
        ins = instructions.quiz;
        break;
      case "CONVERSATION":
        ins = instructions.conversation;
        break;
      case "STORY":
        ins = instructions.story;
        break;
      default:
        throw new AIError("");
    }

    builder.systemMessage(ins.content, "assistant", ins.version, {
      cache: true,
    });

    if (type !== "CONVERSATION") {
      const voices = await VoiceManager.getTenVoiceFor(this.language);

      const voicesMsg = msg("Available voices:");

      for (const voice of voices ?? []) {
        voicesMsg.addKv(
          `Voice '${voice.shortName}'`,
          msg()
            .addKv("Gender", voice.gender)
            .addKv("Styles", voice.styles.join(", "))
        );
      }

      builder.systemMessage(voicesMsg, "thread", 1);
    }

    const req = msg();

    req.addKv(
      "Journey",
      await journeySummary(this.flow.journey, this.flow.user)
    );

    req.addKv("Progress", progressSummary(this.flow.journey));

    req.addKv("Stage", summarizeStageFocus(this.flow.stage));

    req.addKv("Generation Instruction:", (g) => {
      const material = this.requiredMaterial;
      if (material.improves.length > 0) {
        g.addKv("Will be improved", material.improves.join(", "));
      }
      if (material.measures.length > 0) {
        g.addKv("Will be measured", material.measures.join(", "));
      }
      if (material.instructions) {
        g.addKv("Instruction", material.instructions);
      }
    });

    const journeyToName = LanguageHelper.getEnglishName(this.flow.journey.to);

    req.add(
      `All user-facing fields (except picture prompts) must be in the target language (${journeyToName}).`
    );

    builder.userMessage(req);

    return builder;
  }

  public async _updateMaterial(updates: Partial<IMaterial>) {
    if (!this.requiredMaterial) {
      throw new AIError("Material type not expected");
    }

    const newMaterial = await Material.findByIdAndUpdate(
      this.requiredMaterial._id,
      {
        $set: updates,
      }
    );

    if (!newMaterial) {
      throw new Error("Material not updated");
    }

    this.requiredMaterial = newMaterial;
  }

  // public async setMeta(meta: BrocaTypes.Material.MaterialMetadata) {
  //   const type = meta.type;

  //   if (!this.requiredMetas[type]) {
  //     throw new AIError("Material type not expected");
  //   }

  //   const req = this.requiredMetas[type];

  //   if (req.material) {
  //     await this._updateMaterial(type, {
  //       metadata: meta,
  //     });
  //   } else {
  //     req.metadata = meta;
  //   }
  // }

  public async setDetails(material: BrocaTypes.Material.MaterialDetails) {
    if (!this.requiredMaterial) {
      throw new AIError("Material type not expected");
    }

    await this._updateMaterial({
      details: material,
      genStatus: "PREPARING",
    });
  }
}

export class StageGeneratingContext extends MaterialBaseContext {
  constructor(public flow: MaterialFlowContext, public isInitial: boolean) {
    super({
      flow: flow,
      reason: "stage generating",
      type: "stager",
    });
  }

  public stageMeta: BrocaTypes.Progress.Stage | null = null;
  public stageParts: BrocaTypes.Progress.StagePart[] = [];

  /**
   *
   * Required Instructions:
   *
   * Main Instruction
   *
   * Journey Summary
   *
   * Progress Summary
   *
   * Last Stages Summaries
   *
   * Instruction to new stage
   */
  public async getStagePrompt() {
    const builder = new PromptBuilder();

    const ins = instructions.stager;

    builder.systemMessage(ins.content, "assistant", ins.version, {
      cache: true,
    });

    let contextMsg = msg();

    contextMsg.add(await journeySummary(this.flow.journey, this.flow.user));

    contextMsg.add(progressSummary(this.flow.journey));

    contextMsg.add(await lastStagesSummaries(this.flow.journey));

    builder.systemMessage(contextMsg, "none", 1);

    builder.userMessage(withTag(additionalInstructions.other_stage, "request"));

    return builder;
  }
}

// export class StagePreparingContext extends MaterialBaseContext {
//   constructor(public flow: MaterialFlowContext) {
//     super({
//       flow: flow,
//       reason: "stage preparing",
//       type: "progress",
//     });
//   }
// }

/**
 * Mümkün senaryolar:
 *
 * 1. Analiz et ve yeni bir stage oluştur.
 * 2. Sadece analiz et.
 * 3. Sadece stage oluştur.
 *
 * Prompt:
 *
 * 1. Analiz et ve yeni bir stage oluştur:
 *    - main instruction
 *    - journey summary
 *    - material and answer
 *    - old stage topics
 *
 * 2. Sadece analiz et:
 *    - main instruction
 *    - journey summary
 *    - material and answer
 *
 * 3. Sadece init stage oluştur:
 *    - main instruction
 *    - new stage topics - instructions
 *
 */
export class AnalyzingContext extends MaterialBaseContext {
  constructor(public flow: MaterialFlowContext) {
    super({
      flow: flow,
      reason: "analyzing",
      type: "analyzer",
    });
  }

  public newLevel: BrocaTypes.Progress.PathLevel | null = null;
  public note: string | null = null;
  public observations: {
    general?: BrocaTypes.Progress.AIObservationEdit;
    weaknesses?: BrocaTypes.Progress.AIObservationEdit;
    strengths?: BrocaTypes.Progress.AIObservationEdit;
  } = {};
  public successRate: number | null = null;

  public async updateJourney(updates: {
    $set: {
      [key: string]: any;
    };
  }) {
    if (!this.flow.journey) {
      throw new Error("Journey not found");
    }

    const updated = await Journey.findByIdAndUpdate(
      this.flow.journey._id,
      updates
    );

    if (!updated) {
      throw new Error("Journey not updated");
    }

    this.flow.journey = updated;
  }

  /**
   *
   * Required Instructions:
   *
   * Main Instruction
   *
   * Journey Summary
   *
   * Progress Summary
   *
   * Answered Material and Answer
   *
   *
   */
  public async getAnalysisPrompt() {
    const builder = new PromptBuilder();

    const ins = instructions.analyzer;

    builder.systemMessage(ins.content, "assistant", ins.version, {
      cache: true,
    });

    const req = msg();

    req.add(await journeySummary(this.flow.journey, this.flow.user));

    req.add(progressSummary(this.flow.journey));

    req.addKv("Previous Behaviours", await previousBehaviors(this.flow.stage));

    if (this.flow.answeredMaterial && this.flow.userAnswer) {
      req.add(
        describeMaterialAnswer(
          this.flow.answeredMaterial!,
          this.flow.userAnswer!,
          false
        )
      );
    } else {
      throw new Error("Answered material or user answer not found");
    }

    builder.userMessage(req);

    return builder;
  }

  public async updateAnsweredMaterial(updates: Partial<IMaterial>) {
    if (!this.flow.answeredMaterial) {
      throw new Error("Answered material not found");
    }

    const newMaterial = await Material.findByIdAndUpdate(
      this.flow.answeredMaterial._id,
      {
        $set: updates,
      }
    );

    if (!newMaterial) {
      throw new Error("Material not updated");
    }

    this.flow.answeredMaterial = newMaterial;
  }
}

export class FeedbackContext extends MaterialBaseContext {
  constructor(public flow: MaterialFlowContext) {
    super({
      flow: flow,
      reason: "feedback",
      type: "feedback",
    });
  }

  /**
   *
   * Required Instructions:
   *
   * Main Instruction
   *
   * Journey Summary
   *
   * Answered Material and Answer
   *
   *
   */
  public async getFeedbackPrompt() {
    const builder = new PromptBuilder();

    const ins = instructions.feedback;

    builder.systemMessage(ins.content, "assistant", ins.version, {
      cache: true,
    });

    const req = msg();

    req.add(await journeySummary(this.flow.journey, this.flow.user));

    if (!this.flow.answeredMaterial || !this.flow.userAnswer) {
      throw new Error("Answered material or user answer not found");
    }

    req.add(
      describeMaterialAnswer(
        this.flow.answeredMaterial!,
        this.flow.userAnswer!,
        false
      )
    );

    const journeyToName = LanguageHelper.getEnglishName(this.flow.journey.to);

    req.add(
      `All user-facing fields must be in the target language (${journeyToName}).`
    );

    builder.userMessage(req);

    return builder;
  }
}

export class AnswerContext extends GenerationContext {
  public get sttModel(): keyof typeof AIModels.stt {
    return this.flow.journey.sttModel! as keyof typeof AIModels.stt;
  }

  toJSON() {
    return {
      ...this.flow.toJSON(),
    };
  }
  constructor(public flow: MaterialFlowContext) {
    super("idle", "preparing-answer");
  }

  public get materialType() {
    if (!this.flow.answeredMaterial) {
      throw new Error("Answered material not found");
    }
    return this.flow.answeredMaterial!.details!.type;
  }

  public get material() {
    if (!this.flow.answeredMaterial) {
      throw new Error("Answered material not found");
    }
    return this.flow.answeredMaterial!;
  }

  public get rawAnswer() {
    return this.flow.rawAnswer;
  }

  public async setAnswer(answer: any) {
    const newAnswer = await UserAnswer.insertOne({
      material_ID: this.material._id,
      answers: answer,
      user_ID: this.flow.user._id,
    });

    if (!newAnswer) {
      throw new Error("Answer not created");
    }

    this.flow.userAnswer = newAnswer;
  }
}
