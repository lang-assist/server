import { ObjectId, WithId } from "mongodb";
import {
  AiFeedback,
  ConversationTurn,
  IAiFeedback,
  IJourney,
  IMaterial,
  InitialTemplate,
  IUser,
  IUserAnswer,
  IUserPath,
  Material,
  User,
  UserPath,
} from "../models/_index";
import { Journey } from "../models/_index";
import { MaterialType, QuizDetails } from "../utils/types";
import { ConversationManager } from "./conversation";
import { msg } from "ai-prompter";
import { AzureVoice } from "./voice/azure";
import { StorageService } from "./storage";
import { BaseMaterialTypeHelper } from "./materials/base";
import { ConversationMaterialTypeHelper } from "./materials/conversation";
import { QuizMaterialTypeHelper } from "./materials/quiz";
import { StoryMaterialTypeHelper } from "./materials/story";
import { undefinedOrValue } from "../utils/validators";
import { AIFeedbackInterface, AIGenerationResponse } from "../utils/ai-types";
import {
  InitialMaterialGenerationContext,
  MaterialGenerationContext,
} from "./material-gen";
import { AIModel } from "./ai";

// function modifyMaterials(
//   language: string,

//   material: {
//     details: MaterialDetails;
//     metadata: MaterialMetadata;
//   }
// ): {
//   metadata: MaterialMetadata;
//   details: MaterialDetails;
// } {
//   material.metadata.avatar = randomColor();

//   switch (material.details.type) {
//     case "QUIZ":
//       break;

//     case "STORY":
//       const parts = (material.details as StoryDetails).parts;

//       for (const part of parts) {
//         if (part.type === "PICTURE" && part.picturePrompt) {
//           const id = new ObjectId();
//           PictureHelper.generateItemPicture({
//             itemId: id,
//             prompt: part.picturePrompt,
//           });

//           part.pictureId = id.toHexString();
//         } else if (part.type === "AUDIO" && part.ssml) {
//           part.audioId = speechAudio(part.ssml!, language);
//         } else if (part.type === "QUESTION" && part.question) {
//           part.question = modifyQuestion(part.question);
//         }
//       }

//       break;
//   }

//   return {
//     metadata: material.metadata,
//     details: material.details,
//   };
// }

type GenerationPromise = Promise<{
  material: WithId<IMaterial> | null;
  feedbacks: WithId<IAiFeedback>[];
}>;

export class MaterialHelper {
  static generatingMaterials: {
    [path: string]: {
      [materialId: string]: {
        ctx: MaterialGenerationContext;
        promise: GenerationPromise;
      };
    };
  } = {};

  static analyzingMaterials: {
    [path: string]: {
      [materialId: string]: {
        ctx: MaterialGenerationContext;
        promise: GenerationPromise;
      };
    };
  } = {};

  static async handleFeedbacks(
    ctx: MaterialGenerationContext,
    feedback: AIFeedbackInterface
  ) {
    const inserted = await AiFeedback.insertOne({
      feedback,
      seen: false,
      user_ID: ctx.user._id,
      material_ID: ctx.material!._id,
    });

    if (!inserted) {
      throw new Error("Feedback not inserted");
    }

    return inserted;
  }

  static async prepareMaterial(
    ctx: MaterialGenerationContext,
    result: AIGenerationResponse
  ): Promise<{
    material: WithId<IMaterial> | null;
    feedbacks: WithId<IAiFeedback>[];
  }> {
    if (!result) {
      ctx.addError(new Error("Material not created"));
      return {
        material: null,

        feedbacks: [],
      };
    }

    const newMaterials = undefinedOrValue(result.newMaterials, undefined);

    if (ctx.generatingMaterial && !newMaterials) {
      ctx.addError(new Error("Required materials not created"));
      return {
        material: null,
        feedbacks: [],
      };
    }

    let matPromise: Promise<void> | null = null;

    if (ctx.generatingMaterial) {
      if (!ctx.generatingMaterial.material) {
        ctx.addError(new Error("Generation not started correctly"));
        return {
          material: null,
          feedbacks: [],
        };
      }

      const mat = ctx.generatingMaterial.material;

      if (!mat) {
        ctx.addError(new Error("Required material not created"));
        return {
          material: null,
          feedbacks: [],
        };
      }

      matPromise = BaseMaterialTypeHelper.prepare(ctx);
    }

    const feedbackPromises: Promise<WithId<IAiFeedback> | null>[] = [];

    if (ctx.userAnswer && result.feedbacks && ctx.material) {
      const aiFeedbackRes = result.feedbacks;

      for (const feedback of aiFeedbackRes) {
        feedbackPromises.push(this.handleFeedbacks(ctx, feedback));
      }
    }

    if (matPromise) {
      await matPromise;
    }

    const feedbacks = (await Promise.all(feedbackPromises)).filter(
      (f) => f !== null
    ) as WithId<IAiFeedback>[];

    return {
      material: ctx.generatingMaterial?.material || null,
      feedbacks: feedbacks.filter((f) => f !== null) as WithId<IAiFeedback>[],
    };
  }

  static async addGen(ctx: MaterialGenerationContext): Promise<{
    material: WithId<IMaterial> | null;
    feedbacks: WithId<IAiFeedback>[];
  }> {
    const pathId = ctx.path._id.toHexString();

    const genMaterialId = ctx.generatingMaterial?.material._id.toHexString();
    const analyzingMaterialId = ctx.material?._id.toHexString();

    if (genMaterialId && !this.generatingMaterials[pathId]) {
      this.generatingMaterials[pathId] = {};
    }

    if (analyzingMaterialId && !this.analyzingMaterials[pathId]) {
      this.analyzingMaterials[pathId] = {};
    }

    const promise = new Promise<{
      material: WithId<IMaterial> | null;
      feedbacks: WithId<IAiFeedback>[];
    }>(async (resolve, reject) => {
      const res = await AIModel.generate(ctx);

      const prepRes = await this.prepareMaterial(ctx, res);

      resolve(prepRes);
    });

    if (genMaterialId) {
      this.generatingMaterials[pathId][genMaterialId] = {
        ctx,
        promise,
      };
    }

    if (analyzingMaterialId) {
      this.analyzingMaterials[pathId][analyzingMaterialId] = {
        ctx,
        promise,
      };
    }

    promise.finally(() => {
      if (genMaterialId) {
        delete this.generatingMaterials[pathId][genMaterialId];
      }

      if (analyzingMaterialId) {
        delete this.analyzingMaterials[pathId][analyzingMaterialId];
      }

      if (Object.keys(this.generatingMaterials[pathId]).length === 0) {
        delete this.generatingMaterials[pathId];
      }

      if (Object.keys(this.analyzingMaterials[pathId]).length === 0) {
        delete this.analyzingMaterials[pathId];
      }
    });

    return promise;
  }

  static async testGenMaterial(args: {
    journeyId: ObjectId;
    pathId: ObjectId;
    user: WithId<IUser>;
    requiredMaterials: {
      material?: WithId<IMaterial>;
      type: MaterialType;
      optional?: boolean;
      description?: string;
    };
  }) {
    if (!args.requiredMaterials.material) {
      args.requiredMaterials.material = await this.createPreparingMaterial({
        userId: args.user._id,
        journeyId: args.journeyId,
        pathId: args.pathId,
      });
    }

    const ctx = await MaterialGenerationContext.create({
      user: args.user,
      journeyId: args.journeyId,
      pathId: args.pathId,
    });

    const result = await this.addGen(ctx);

    return result.material;
  }

  static async createPreparingMaterial(args: {
    userId: ObjectId;
    journeyId: ObjectId;
    pathId: ObjectId;
    id?: ObjectId;
  }) {
    const material = await Material.insertOne(
      {
        genStatus: "CREATING",
        compStatus: "NOT_STARTED",
        convStatus: "NOT_STARTED",
        user_ID: args.userId,
        journey_ID: args.journeyId,
        path_ID: args.pathId,
      },
      args.id
    );

    if (!material) {
      throw new Error("Material not inserted");
    }

    return material;
  }

  static async regenerateMaterial(materialId: ObjectId, user: WithId<IUser>) {
    const material = await Material.findById(materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    await Material.findByIdAndDelete(materialId);

    const mat = await this.createPreparingMaterial({
      userId: material.user_ID,
      journeyId: material.journey_ID,
      pathId: material.path_ID,
    });

    const ctx = await MaterialGenerationContext.create({
      user: user,
      journeyId: material.journey_ID,
      pathId: material.path_ID,
      generatingMaterial: {
        type: material.details.type,
        material: mat,
        optional: false,
        description: "",
      },
    });

    const result = await this.addGen(ctx);

    return result.material;
  }

  // static async prepareMaterial(input: {
  //   materialId: ObjectId;
  //   language: string;
  // }): Promise<WithId<IMaterial>> {
  //   const material = await Material.findById(input.materialId);
  //   if (!material) {
  //     throw new Error("Material not found");
  //   }

  //   modifyMaterials(input.language, material);

  //   const modified = await Material.findByIdAndUpdate(material._id, {
  //     $set: {
  //       details: material.details,
  //       metadata: material.metadata,
  //     },
  //   });

  //   if (!modified) {
  //     throw new Error("Material not updated");
  //   }

  //   return modified;
  // }

  static generatingCount(pathId: string) {
    if (!this.generatingMaterials[pathId]) {
      return 0;
    }

    let count = 0;

    for (const _ in this.generatingMaterials[pathId]) {
      count += 1;
    }

    return count;
  }

  static generatingPathMaterials(pathId: string): string[] {
    if (!this.generatingMaterials[pathId]) {
      return [];
    }

    return Object.keys(this.generatingMaterials[pathId]);
  }

  static async getInitialMaterials(
    journey: WithId<IJourney>,
    level: 1 | 2 | 3
  ) {
    const template = await InitialTemplate.findOne({
      locale: journey.to,
      level,
      aiModel: journey.aiModel,
    });

    if (!template) {
      const existingTemplates = await InitialTemplate.find({
        locale: journey.to,
        aiModel: journey.aiModel,
        level: {
          $gt: level,
        },
      });

      const existingMaterials = existingTemplates.flatMap((t) =>
        t.materials.map((m) => ({
          level: t.level,
          details: m.details,
          metadata: m.metadata,
        }))
      );

      const ctx = new InitialMaterialGenerationContext({
        journey,
        level,
        existingInitMaterials: existingMaterials,
      });

      const result = await AIModel.generate<"material">(ctx);

      const newMaterials = undefinedOrValue(result.newMaterials, {});

      if (!newMaterials) {
        throw new Error("No new materials");
      }

      BaseMaterialTypeHelper.prepareInitial(
        ctx,
        [
          newMaterials.QUIZ,
          newMaterials.CONVERSATION,
          newMaterials.STORY,
        ].filter((m) => m !== undefined)
      );

      const inserted = await InitialTemplate.insertOne({
        locale: journey.to,
        level,
        materials: [
          newMaterials.QUIZ,
          newMaterials.CONVERSATION,
          newMaterials.STORY,
        ].filter((m) => m !== undefined),
        aiModel: journey.aiModel,
      });

      if (!inserted) {
        throw new Error("Template not inserted");
      }

      return inserted.materials;
    }

    return template.materials;
  }

  static async createMaterialForInitial(input: {
    journeyId: ObjectId;
    pathId: ObjectId;
  }): Promise<WithId<IMaterial>[]> {
    const journey = await Journey.findById(input.journeyId);
    if (!journey) {
      throw new Error("Journey not found");
    }

    let path = await UserPath.findById(input.pathId);
    if (!path) {
      throw new Error("Path not found");
    }

    if (path.type !== "INITIAL") {
      throw new Error("Path is not initial");
    }

    if (!path.initialLevel) {
      path = await UserPath.findByIdAndUpdate(path._id, {
        $set: {
          initialLevel: 3,
        },
      });

      if (!path) {
        throw new Error("Path not found");
      }
    } else {
      if (path.initialLevel === 1) {
        throw new Error("Path initial level is 1");
      }

      path = await UserPath.findByIdAndUpdate(path._id, {
        $set: {
          initialLevel: (path.initialLevel - 1) as 3 | 2 | 1,
        },
      });

      if (!path) {
        throw new Error("Path not found");
      }
    }

    const initialLevel = path.initialLevel;

    let template = await this.getInitialMaterials(journey, initialLevel!);

    await Material.deleteMany({
      journey_ID: journey._id,
      path_ID: path._id,
    });

    const materials: WithId<IMaterial>[] = [];
    for (const material of template) {
      const inserted = await Material.insertOne({
        journey_ID: journey._id,
        path_ID: path._id,
        user_ID: path.user_ID,
        compStatus: "NOT_STARTED",
        genStatus: "COMPLETED",
        convStatus: "NOT_STARTED",
        metadata: material.metadata,
        details: material.details,
        step: 0,
      });
      if (inserted) {
        materials.push(inserted);
        if (material.details.type === "CONVERSATION") {
          User.findById(path.user_ID)
            .then((user) => {
              if (!user) {
                throw new Error("User not found");
              }

              ConversationManager.prepareConversation(inserted._id, user).catch(
                (err) => {
                  console.error("ERR", err);
                }
              );
            })
            .catch((err) => {
              console.error("ERR", err);
            });
        }
      }
    }

    await UserPath.findByIdAndUpdate(path._id, {
      $set: {
        stage: "1",
      },
    });

    return materials;
  }

  static async handleInitialAnswer(args: {
    existingPath: WithId<IUserPath>;
    journey: WithId<IJourney>;
    user: WithId<IUser>;
    answer: WithId<IUserAnswer>;
    material: WithId<IMaterial>;
  }): Promise<{
    next: "CREATING_NEW" | "INITIAL_END" | "INITIAL_CONTINUE";
    newPath: ObjectId | null;
    newGen: string | null;
  }> {
    // Check all materials answered
    const unAnsweredMaterials = await Material.find({
      completionStatus: "NOT_STARTED",
    });

    const existingPath = args.existingPath;

    if (unAnsweredMaterials.length === 0) {
      // check if analyzing already
      const currentlyGenerating =
        this.generatingMaterials[existingPath._id.toHexString()];

      if (currentlyGenerating) {
        await Promise.all(
          Object.values(currentlyGenerating).map((g) => g.promise)
        );
      }

      const created = await UserPath.insertOne({
        journey_ID: args.journey._id,
        user_ID: args.user._id,
        type: "GENERAL",
        isActive: true,
        isMain: true,
        progress: existingPath.progress,
        name: "General",
        lastStudyDate: Date.now(),
        description: "General path",
      });

      if (!created) {
        throw new Error("Path not created");
      }

      const ctx = new MaterialGenerationContext({
        journey: args.journey,
        path: created,
        user: args.user,
        userAnswer: args.answer,
        material: args.material,
        generatingMaterial: {
          type: "STORY",
          material: await this.createPreparingMaterial({
            userId: args.user._id,
            journeyId: args.journey._id,
            pathId: created._id,
          }),
        },
      });

      await this.addGen(ctx);

      const ctxs = [
        new MaterialGenerationContext({
          journey: args.journey,
          path: created,
          user: args.user,
          generatingMaterial: {
            type: "QUIZ",
            material: await this.createPreparingMaterial({
              userId: args.user._id,
              journeyId: args.journey._id,
              pathId: created._id,
            }),
          },
        }),
        new MaterialGenerationContext({
          journey: args.journey,
          path: created,
          user: args.user,
          generatingMaterial: {
            type: "CONVERSATION",
            material: await this.createPreparingMaterial({
              userId: args.user._id,
              journeyId: args.journey._id,
              pathId: created._id,
            }),
          },
        }),
      ];

      for (const ctx of ctxs) {
        await this.addGen(ctx);
      }

      // Deactivate old path
      await UserPath.findByIdAndUpdate(existingPath._id, {
        $set: {
          isActive: false,
          isMain: false,
        },
      });

      return {
        next: "INITIAL_END",
        newPath: created._id,
        newGen: null,
      };
    } else {
      const analyzeGen = new NewMaterialGen(
        new MaterialGenerationContext({
          journey: args.journey,
          path: existingPath,
          user: args.user,
          generatingMaterial: undefined,
        }),
        "material"
      );

      this.addGen(analyzeGen);

      analyzeGen.generate();

      return {
        next: "INITIAL_CONTINUE",
        newPath: null,
        newGen: null,
      };
    }
  }

  static async prepareAnswer(args: {
    answer: any;
    material: WithId<IMaterial>;
  }) {
    let answer: any | undefined = undefined;

    const material = args.material;
    if (material.compStatus !== "NOT_STARTED") {
      throw new Error("Material already answered");
    }
    if (material.details.type === "CONVERSATION") {
      if (material.convStatus !== "COMPLETED") {
        throw new Error("Conversation is not completed");
      }

      const turns = await ConversationTurn.find({
        material_ID: material._id,
      });

      if (turns.length === 0) {
        throw new Error("Conversation has no turns");
      }

      const message = msg();

      message.addKv("Conversation", (msg) => {
        for (const turn of turns) {
          msg.addKv(`- ${turn.character}`, turn.text);
          if (turn.analyze) {
            msg.addKv("Analysis", (msg) => {
              for (const [key, value] of Object.entries(turn.analyze!)) {
                msg.addKv(`${key}`, value);
              }
            });
          }
        }
      });

      answer = message.build();
    } else if (material.details.type === "QUIZ") {
      answer = args.answer as {
        [key: string]: any;
      };

      const recordQuestions = (
        material.details as QuizDetails
      ).questions.filter((q) => q.type === "RECORD");

      for (const question of recordQuestions) {
        if (!answer[question.id]) {
          throw new Error("Answer is missing for question: " + question.id);
        }

        if (!ObjectId.isValid(answer[question.id])) {
          throw new Error(
            "Answer is not a valid audio id: " + answer[question.id]
          );
        }

        try {
          const buffer = await StorageService.getAudio(
            new ObjectId(answer[question.id] as string)
          );

          if (!buffer) {
            throw new Error("Audio not found");
          }

          console.log("HERE 2 Before transcription");

          const transcription = await AzureVoice.speechToText(buffer);

          console.log("HERE 3 After transcription", transcription);

          const message = msg();

          message.addKv("Transcription", transcription.text);

          if (transcription.analyze) {
            message.add((analysis) => {
              analysis.addKv("Analysis", (msg) => {
                for (const [key, value] of Object.entries(
                  transcription.analyze
                )) {
                  msg.addKv(`${key}`, value as any);
                }
              });
            });
          }

          answer[question.id] = message.build();
        } catch (e) {
          console.error("ERR", e);
          throw new Error("Error transcribing audio");
        }
      }
    } else {
      answer = args.answer;
    }

    return answer;
  }

  static async answerMaterial(input: {
    materialId: ObjectId;
    user: WithId<IUser>;
    answer: any;
  }): Promise<{
    next: "CREATING_NEW" | "INITIAL_END" | "INITIAL_CONTINUE";
    newPath: ObjectId | null;
    newGen: string | null;
  }> {
    const material = await Material.findById(input.materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    const answer = await this.prepareAnswer({
      answer: input.answer,
      material: material,
    });

    const ctx = await MaterialGenerationContext.create({
      user: input.user,
      material: material,
      userAnswer: answer,
    });

    await ctx.updateMaterial({
      compStatus: "COMPLETED",
    });

    if (ctx.path.type === "INITIAL") {
      return await this.handleInitialAnswer({
        existingPath: ctx.path,
        journey: ctx.journey,
        user: ctx.user,
        answer: answer,
        material: material,
      });
    } else {
      ctx.generatingMaterial = {
        type: material.details.type,
        material: await this.createPreparingMaterial({
          userId: ctx.user._id,
          journeyId: ctx.journey._id,
          pathId: ctx.path._id,
        }),
      };

      const gen = new NewMaterialGen(ctx, "material");

      gen.generate();

      return {
        next: "CREATING_NEW",
        newPath: null,
        newGen: ctx.generatingMaterial!.material._id.toHexString(),
      };
    }
  }
}
