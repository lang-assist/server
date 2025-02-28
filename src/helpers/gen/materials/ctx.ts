import {
  Material,
  IUser,
  IUserAnswer,
  IJourney,
  IMaterial,
  UserAnswer,
  Journey,
} from "../../../models/_index";

import { WithId } from "mongodb";
import { BrocaTypes } from "../../../types";
import { AIError } from "../../../utils/ai-types";
import { MessageBuilder, msg, PromptBuilder } from "../../../utils/prompter";
import { ChatGenerationContextWithGlobalAssistant } from "../../ai/chat/base";
import { AIModels } from "../../../utils/constants";
import {
  describeMaterialAnswer,
  instructions,
  journeySummary,
} from "../../prompts";
import { VoiceManager } from "../../voice";
import { GenerationContext } from "../../../types/ctx";

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
    journey: WithId<IJourney>;
    pathID: string;
    user: WithId<IUser>;
    rawAnswer?: any;
    answeredMaterial?: WithId<IMaterial>;
  }) {
    this.journey = args.journey;
    this.pathID = args.pathID;
    this.user = args.user;
    this.rawAnswer = args.rawAnswer;
    this.answeredMaterial = args.answeredMaterial;
  }

  toJSON() {
    return {
      journeyID: this.journey._id,
      pathID: this.pathID,
      userID: this.user._id,
      answeredMaterialID: this.answeredMaterial?._id,
      rawAnswer: this.rawAnswer,
      userAnswerID: this.userAnswer?._id,
    };
  }

  public journey: WithId<IJourney>;
  public pathID: string;
  public user: WithId<IUser>;

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

  toJSON() {
    return {
      ...super.toJSON(),
      requiredMaterial: {
        type: this.requiredMaterial.type,
        description: this.requiredMaterial.description,
        material: this.requiredMaterial.material?._id,
        metadata: this.requiredMaterial.metadata,
        details: this.requiredMaterial.details,
      },
    };
  }

  constructor(args: {
    flow: MaterialFlowContext;
    requiredMaterial: {
      type: BrocaTypes.Material.MaterialType;
      description?: string;
      material?: WithId<IMaterial>;
    };
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
        throw new AIError("Material type not supported");
    }

    super({
      flow: args.flow,
      reason: args.reason,
      type: genType,
    });

    this.requiredMaterial = args.requiredMaterial;
  }

  public async setCompleted() {
    await this._updateMaterial(this.requiredMaterial.type, {
      genStatus: "COMPLETED",
    });
  }

  public requiredMaterial: {
    type: BrocaTypes.Material.MaterialType;
    description?: string;
    material?: WithId<IMaterial>;
    details?: BrocaTypes.Material.MaterialDetails;
    metadata?: BrocaTypes.Material.MaterialMetadata;
  };

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
        throw new AIError("Material type not supported");
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
          msg().addKv("Styles", voice.styles.join(", "))
        );
      }

      builder.systemMessage(voicesMsg, "thread", 1);
    }

    const req = msg();

    req.add(
      await journeySummary(
        this.flow.journey,
        this.flow.user,
        this.flow.pathID,
        true,
        true
      )
    );

    req.add("User needs to generate a material of type " + type);

    if (this.requiredMaterial.description) {
      req.add(this.requiredMaterial.description);
    }

    builder.userMessage(req);

    return builder;
  }

  private async _updateMaterial(
    type: BrocaTypes.Material.MaterialType,
    updates: Partial<IMaterial>
  ) {
    if (!this.requiredMaterial) {
      throw new AIError("Material type not expected");
    }

    const req = this.requiredMaterial;

    if (req.material) {
      const newMaterial = await Material.findByIdAndUpdate(req.material._id, {
        $set: updates,
      });

      if (!newMaterial) {
        throw new Error("Material not updated");
      }
    }
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

  public async setDetails(
    type: BrocaTypes.Material.MaterialType,
    metadata: BrocaTypes.Material.MaterialMetadata,
    material: BrocaTypes.Material.MaterialDetails
  ) {
    if (!this.requiredMaterial) {
      throw new AIError("Material type not expected");
    }

    const req = this.requiredMaterial;

    if (req.material) {
      await this._updateMaterial(type, {
        details: material,
        metadata: metadata,
        genStatus: "PREPARING",
      });
    } else {
      req.details = material;
      req.metadata = metadata;
    }
  }

  // public setMataRequired(args: {
  //   type: BrocaTypes.Material.MaterialType;
  //   optional: boolean;
  //   description?: string;
  //   material?: WithId<IMaterial>;
  //   metadata?: BrocaTypes.Material.MaterialMetadata;
  // }) {
  //   this.requiredMetas[args.type] = {
  //     description: args.description,
  //     optional: args.optional,
  //     material: args.material,
  //     metadata: args.metadata,
  //   };
  // }

  // private requiredMetas: {
  //   [key in BrocaTypes.Material.MaterialType]?: {
  //     metadata?: BrocaTypes.Material.MaterialMetadata;
  //     details?: BrocaTypes.Material.MaterialDetails;
  //     material?: WithId<IMaterial>;
  //     description?: string;
  //     // promise?: Promise<void>;
  //     // status:
  //     //   | "NOT_STARTED"
  //     //   | "GENERATING"
  //     //   | "PREPARING"
  //     //   | "COMPLETED"
  //     //   | "ERROR";
  //     optional: boolean;
  //   };
  // } = {};

  // public get materialTemplates() {
  //   return Object.values(this.requiredMetas).map((req) => {
  //     return {
  //       metadata: req.metadata!,
  //       details: req.details!,
  //     };
  //   });
  // }
}

export class AnalyzingContext extends MaterialBaseContext {
  constructor(public flow: MaterialFlowContext) {
    super({
      flow: flow,
      reason: "analyzing",
      type: "progress",
    });
  }

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

  public async getAnalysisPrompt() {
    const builder = new PromptBuilder();

    const ins = instructions.progress;

    builder.systemMessage(ins.content, "assistant", ins.version, {
      cache: true,
    });

    const req = msg();

    req.add(
      await journeySummary(
        this.flow.journey,
        this.flow.user,
        this.flow.pathID,
        false,
        true
      )
    );

    if (!this.flow.answeredMaterial || !this.flow.userAnswer) {
      throw new Error("Answered material or user answer not found");
    }

    req.add(
      describeMaterialAnswer(this.flow.answeredMaterial!, this.flow.userAnswer!)
    );

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

  public async getFeedbackPrompt() {
    const builder = new PromptBuilder();

    const ins = instructions.feedback;

    builder.systemMessage(ins.content, "assistant", ins.version, {
      cache: true,
    });

    const req = msg();

    req.add(
      await journeySummary(
        this.flow.journey,
        this.flow.user,
        this.flow.pathID,
        false,
        false
      )
    );

    if (!this.flow.answeredMaterial || !this.flow.userAnswer) {
      throw new Error("Answered material or user answer not found");
    }

    req.add(
      describeMaterialAnswer(this.flow.answeredMaterial!, this.flow.userAnswer!)
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
