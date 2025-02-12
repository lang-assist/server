import { MaterialMetadata, MaterialType, PromptTags } from "../utils/types";
import { ObjectId, WithId } from "mongodb";
import { GenerationContext } from "./ai/base";
import {
  IJourney,
  IMaterial,
  IMaterialTemplate,
  IUser,
  IUserAnswer,
  IUserPath,
  Journey,
  Material,
  UserPath,
} from "../models/_index";
import { MaterialDetails } from "../utils/types";
import {
  initialMaterialGenerationPrompt,
  materialGenInstructions,
} from "./prompts";
import { PromptBuilder } from "ai-prompter";
import { instructions } from "./prompts";
import { AIGeneratedMaterialResponse, AIModels } from "../utils/ai-types";

export class InitialMaterialGenerationContext extends GenerationContext<"material"> {
  constructor(args: {
    journey: WithId<IJourney>;
    level: 1 | 2 | 3;
    existingInitMaterials: {
      level: 1 | 2 | 3;
      details: MaterialDetails;
      metadata: MaterialMetadata;
    }[];
  }) {
    super({
      type: "material",
      aiModel: args.journey.aiModel as AIModels,
      embeddingModel: args.journey.embeddingModel,
      imageGenModel: args.journey.imageGenModel,
      language: args.journey.to,
      mainRef: args.journey._id,
      reason: "initial_template_generation",
    });
    this.level = args.level;
    this.existingInitMaterials = args.existingInitMaterials;
  }

  level: 1 | 2 | 3;

  generating: {
    QUIZ?: AIGeneratedMaterialResponse;
    STORY?: AIGeneratedMaterialResponse;
    CONVERSATION?: AIGeneratedMaterialResponse;
  } = {};

  existingInitMaterials: {
    level: 1 | 2 | 3;
    details: MaterialDetails;
    metadata: MaterialMetadata;
  }[];

  buildPrompt(): void {
    this.builder.args = {
      ...this.builder.args,
      userName: "unknown",
      language: this.language,
    };

    this.builder.systemMessage(instructions.main, {
      extra: {
        tags: [PromptTags.MAIN],
      },
    });

    initialMaterialGenerationPrompt(
      this.builder,
      this.existingInitMaterials,
      this.level
    );
  }
}

export class MaterialGenerationContext extends GenerationContext<"material"> {
  constructor(args: {
    user: WithId<IUser>;
    journey: WithId<IJourney>;
    path: WithId<IUserPath>;
    material?: WithId<IMaterial>;
    rawAnswer?: any;
    userAnswer?: WithId<IUserAnswer>;
    generatingMaterial?: {
      type: MaterialType;
      material: WithId<IMaterial>;
      optional?: boolean;
      description?: string;
    };

    whenComplete?: () => void;
  }) {
    super({
      type: "material",
      aiModel: args.journey.aiModel as AIModels,
      embeddingModel: args.journey.embeddingModel,
      imageGenModel: args.journey.imageGenModel,
      language: args.journey.to,
      mainRef: args.journey._id,
      reason: "material_generation",
      whenComplete: args.whenComplete,
    });

    this.journey = args.journey;
    this.user = args.user;
    this.path = args.path;
    this.material = args.material;
    this.userAnswer = args.userAnswer;
    this.rawAnswer = args.rawAnswer;
  }

  public path: WithId<IUserPath>;
  public journey: WithId<IJourney>;
  public user: WithId<IUser>;
  public material?: WithId<IMaterial>;
  public userAnswer?: WithId<IUserAnswer>;
  public rawAnswer?: any;
  public generatingMaterial?: {
    type: MaterialType;
    material: WithId<IMaterial>;
    optional?: boolean;
    description?: string;
  };

  public async buildPrompt(builder: PromptBuilder) {
    builder.args = {
      ...builder.args,
      userName: this.user.name,
      language: this.language,
    };

    await materialGenInstructions(this, builder);
  }

  get genMaterial(): WithId<IMaterial> {
    return this.generatingMaterial!.material;
  }

  static async create(args: {
    user: WithId<IUser>;
    journeyId?: ObjectId;
    pathId?: ObjectId;
    material?: WithId<IMaterial>;

    materialId?: ObjectId;
    userAnswer?: WithId<IUserAnswer>;
    generatingMaterial?: {
      type: MaterialType;
      material: WithId<IMaterial>;
      optional?: boolean;
      description?: string;
    };
  }) {
    let material: WithId<IMaterial> | null = args.material || null;
    let journey: WithId<IJourney> | null = null;

    let path: WithId<IUserPath> | null = null;

    if (args.materialId && !material) {
      material = await Material.findById(args.materialId);
      if (!material) {
        throw new Error("Material not found");
      }
    }

    if (args.pathId) {
      path = await UserPath.findById(args.pathId);
      if (!path) {
        throw new Error("Path not found");
      }
    } else if (material) {
      path = await UserPath.findById(material.path_ID);
      if (!path) {
        throw new Error("Path not found");
      }
    } else {
      throw new Error("Path or material not found");
    }

    if (args.journeyId) {
      journey = await Journey.findById(args.journeyId);
      if (!journey) {
        throw new Error("Journey not found");
      }
    } else if (path || material) {
      journey = await Journey.findById(
        path?.journey_ID || material?.journey_ID
      );
      if (!journey) {
        throw new Error("Journey not found");
      }
    } else {
      throw new Error("Journey or material not found");
    }

    return new MaterialGenerationContext({
      journey,
      path,
      user: args.user,
      material: material || undefined,
      generatingMaterial: args.generatingMaterial,
      userAnswer: args.userAnswer,
    });
  }

  public async updateMaterial(data: Partial<IMaterial>) {
    if (!this.material) {
      throw new Error("Material not found");
    }

    // @ts-ignore
    this.material = await Material.findByIdAndUpdate(this.material._id, {
      $set: data,
    });

    if (!this.material) {
      throw new Error("Material not found");
    }
  }

  public async updateGeneratingMaterial(data: Partial<IMaterial>) {
    if (!this.generatingMaterial) {
      throw new Error("Generating material not found");
    }

    // @ts-ignore
    this.generatingMaterial.material = await Material.findByIdAndUpdate(
      this.generatingMaterial.material._id,
      {
        $set: data,
      }
    );

    if (!this.generatingMaterial.material) {
      throw new Error("Generating material not found");
    }
  }

  public async toJSON() {
    return {
      material_ID: this.material?._id,
      generating_material_ID: this.generatingMaterial?.material._id,
      journey_ID: this.journey._id,
      path_ID: this.path._id,
      user_ID: this.user._id,
      userAnswer_ID: this.userAnswer?._id,
    };
  }
}
