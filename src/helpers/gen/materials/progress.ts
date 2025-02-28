import {
  IJourney,
  IMaterial,
  InitialTemplate,
  IUser,
  Journey,
  Material,
} from "../../../models/_index";
import { ObjectId, WithId } from "mongodb";
import { BaseMaterialTypeHelper } from "./type-helpers/base";
import { FeedbackHelper } from "./feedback";

import {
  AnalyzingContext,
  AnswerContext,
  FeedbackContext,
  MaterialGenerationContext,
  MaterialFlowContext,
} from "./ctx";
import { MaterialGenerationHelper } from "./generation";
import { BrocaTypes } from "../../../types";
import { ChatGeneration } from "../../ai";
import { undefinedOrValue } from "../../../utils/validators";
import { randomString } from "../../../utils/random";
import { WithGQLID } from "../../db";

export class ProgressHelper {
  private static analyzingMaterials: {
    [journeyId: string]: AnalyzingContext;
  } = {};

  private static updateArray(
    array: string[],
    updates: BrocaTypes.Progress.AIObservationEdit
  ) {
    if (updates.add) {
      array.push(...updates.add);
    }
    if (updates.remove) {
      array.push(...updates.remove);
    }
    if (updates.replace) {
      for (const replace of updates.replace) {
        const index = array.findIndex((item) => item === replace[0]);
        if (index !== -1) {
          array[index] = replace[1];
        } else {
          array.push(replace[1]);
        }
      }
    }

    return array;
  }

  private static async createGeneratingMaterial(args: {
    metadata?: BrocaTypes.Material.MaterialMetadata;
    journey: WithId<IJourney>;
    pathID: string;
  }) {
    const mat = await Material.insertOne({
      compStatus: "NOT_STARTED",
      convStatus: "NOT_STARTED",
      genStatus: "CREATING",
      feedbackStatus: "NOT_STARTED",
      metadata: args.metadata,
      journey_ID: args.journey._id,
      user_ID: args.journey.user_ID,
      pathID: args.pathID,
    });

    if (!mat) {
      throw new Error("Material not created");
    }

    return mat;
  }

  static async getInitialMaterials(input: {
    journeyId: ObjectId;
    user: WithId<IUser>;
  }): Promise<WithGQLID<IMaterial>[]> {
    const journey = await Journey.findById(input.journeyId);
    if (!journey) {
      throw new Error("Journey not found");
    }

    const initialTemplate = await InitialTemplate.findOne({
      language: journey.to,
      aiModel: journey.chatModel,
    });

    if (!initialTemplate) {
      return await ProgressHelper.createMaterialForInitial(input);
    }

    const materials: WithGQLID<IMaterial>[] = [];

    for (const material of initialTemplate.materials) {
      const inserted = await Material.insertOne({
        journey_ID: journey._id,
        pathID: "initial",
        user_ID: journey.user_ID,
        compStatus: "NOT_STARTED",
        genStatus: "COMPLETED",
        convStatus: "NOT_STARTED",
        feedbackStatus: "NOT_STARTED",
        metadata: material.metadata,
        details: material.details,
      });

      if (inserted) {
        materials.push(inserted);
      }
    }

    return materials;
  }

  static async createMaterialForInitial(input: {
    journeyId: ObjectId;
    user: WithId<IUser>;
  }): Promise<WithGQLID<IMaterial>[]> {
    const journey = await Journey.findById(input.journeyId);
    if (!journey) {
      throw new Error("Journey not found");
    }

    let path = journey.paths.initial;

    if (!path) {
      throw new Error("Path not found");
    }

    const flowCtx = new MaterialFlowContext({
      journey,
      pathID: "initial",
      user: input.user,
    });

    const ctxs = [
      new MaterialGenerationContext({
        reason: "initial",
        flow: flowCtx,
        requiredMaterial: {
          type: "QUIZ",
          description:
            "This is the initial quiz. Before the user starts to learn, we don't have any information about user level in the language. So we need to ask questions to determine the user level. For this, we will ask only 2 questions: TEXT_INPUT_WRITE, RECORD. This allows user to answer generically and we can determine the user level.",
        },
      }),
      new MaterialGenerationContext({
        reason: "initial",
        flow: flowCtx,
        requiredMaterial: {
          type: "CONVERSATION",
        },
      }),
      new MaterialGenerationContext({
        reason: "initial",
        flow: flowCtx,
        requiredMaterial: {
          type: "STORY",
        },
      }),
    ];

    const template: BrocaTypes.Material.Material[] = [];

    const promises: Promise<void>[] = [];

    for (const ctx of ctxs) {
      MaterialGenerationHelper.gen(ctx);
      promises.push(ctx.waitUntil("completed"));
    }

    await Promise.all(promises);

    for (const ctx of ctxs) {
      template.push({
        metadata: ctx.requiredMaterial.metadata!,
        details: ctx.requiredMaterial.details!,
      });
    }

    await InitialTemplate.insertOne({
      language: journey.to,
      level: 1,
      materials: template,
      aiModel: journey.chatModel,
    });

    await Material.deleteMany({
      journey_ID: journey._id,
      pathID: "initial",
      user_ID: journey.user_ID,
    });

    const materials: WithGQLID<IMaterial>[] = [];

    for (const material of template) {
      const inserted = await Material.insertOne({
        journey_ID: journey._id,
        pathID: "initial",
        user_ID: journey.user_ID,
        compStatus: "NOT_STARTED",
        genStatus: "COMPLETED",
        convStatus: "NOT_STARTED",
        feedbackStatus: "NOT_STARTED",
        metadata: material.metadata,
        details: material.details,
      });
      if (inserted) {
        materials.push(inserted);
      }
    }

    return materials;
  }

  //   static async prepareAnswer(args: {
  //     answer: any;
  //     material: WithId<IMaterial>;
  //   }) {
  //     let answer: any | undefined = undefined;

  //     const material = args.material;
  //     if (material.compStatus !== "NOT_STARTED") {
  //       throw new Error("Material already answered");
  //     }
  //     if (material.details.type === "CONVERSATION") {
  //       if (material.convStatus !== "COMPLETED") {
  //         throw new Error("Conversation is not completed");
  //       }

  //       const turns = await ConversationTurn.find({
  //         material_ID: material._id,
  //       });

  //       if (turns.length === 0) {
  //         throw new Error("Conversation has no turns");
  //       }

  //       const message = msg();

  //       message.addKv("Conversation", (msg) => {
  //         for (const turn of turns) {
  //           msg.addKv(`- ${turn.character}`, turn.text);
  //           if (turn.analyze) {
  //             msg.addKv("Analysis", (msg) => {
  //               for (const [key, value] of Object.entries(turn.analyze!)) {
  //                 msg.addKv(`${key}`, value);
  //               }
  //             });
  //           }
  //         }
  //       });

  //       answer = message.build();
  //     } else if (material.details.type === "QUIZ") {
  //       answer = args.answer as {
  //         [key: string]: any;
  //       };

  //       const recordQuestions = (
  //         material.details as QuizDetails
  //       ).questions.filter((q) => q.type === "RECORD");

  //       for (const question of recordQuestions) {
  //         if (!answer[question.id]) {
  //           throw new Error("Answer is missing for question: " + question.id);
  //         }

  //         if (!ObjectId.isValid(answer[question.id])) {
  //           throw new Error(
  //             "Answer is not a valid audio id: " + answer[question.id]
  //           );
  //         }

  //         try {
  //           const buffer = await StorageService.getAudio(
  //             new ObjectId(answer[question.id] as string)
  //           );

  //           if (!buffer) {
  //             throw new Error("Audio not found");
  //           }


  //           const transcription = await AzureVoice.speechToText(buffer);


  //           const message = msg();

  //           message.addKv("Transcription", transcription.text);

  //           if (transcription.analyze) {
  //             message.add((analysis) => {
  //               analysis.addKv("Analysis", (msg) => {
  //                 for (const [key, value] of Object.entries(
  //                   transcription.analyze
  //                 )) {
  //                   msg.addKv(`${key}`, value as any);
  //                 }
  //               });
  //             });
  //           }

  //           answer[question.id] = message.build();
  //         } catch (e) {
  //           console.error("ERR", e);
  //           throw new Error("Error transcribing audio");
  //         }
  //       }
  //     } else {
  //       answer = args.answer;
  //     }

  //     return answer;
  //   }

  /**
   * true indicates that path is completed
   *
   */
  static async handleInitialAnswer(ctx: AnalyzingContext): Promise<{
    next: "CREATING_NEW" | "INITIAL_END" | "INITIAL_CONTINUE";
    newPath: string | null;
    newMaterial: ObjectId | null;
  }> {
    try {
      const hasUnAnsweredMaterials = await this.hasUnAnsweredMaterials(
        ctx.flow.journey._id,
        ctx.flow.pathID,
        ctx.flow.user._id
      );

      if (!hasUnAnsweredMaterials) {
        await ctx.waitUntil("completed");

        const newPathId = randomString(24);

        await ctx.updateJourney({
          $set: {
            "paths.initial.isActive": false,
            "paths.initial.isMain": false,
            [`paths.${newPathId}`]: {
              isActive: true,
              isMain: true,
              type: "GENERAL",
              name: "General",
            },
          },
        });

        ctx.flow.pathID = newPathId;

        const ctxs = [
          new MaterialGenerationContext({
            reason: "path",
            flow: ctx.flow,
            requiredMaterial: {
              type: "QUIZ",
              material: await this.createGeneratingMaterial({
                journey: ctx.flow.journey,
                pathID: newPathId,
              }),
            },
          }),
          new MaterialGenerationContext({
            reason: "path",
            flow: ctx.flow,
            requiredMaterial: {
              type: "CONVERSATION",
              material: await this.createGeneratingMaterial({
                journey: ctx.flow.journey,
                pathID: newPathId,
              }),
            },
          }),
          new MaterialGenerationContext({
            reason: "path",
            flow: ctx.flow,
            requiredMaterial: {
              type: "STORY",
              material: await this.createGeneratingMaterial({
                journey: ctx.flow.journey,
                pathID: newPathId,
              }),
            },
          }),
        ];

        for (const ctx of ctxs) {
          MaterialGenerationHelper.gen(ctx);
        }

        return {
          next: "INITIAL_END",
          newPath: newPathId,
          newMaterial: null,
        };
      } else {
        return {
          next: "INITIAL_CONTINUE",
          newPath: null,
          newMaterial: null,
        };
      }
    } catch (e) {
      throw e;
    }
  }

  static async hasUnAnsweredMaterials(
    journeyId: ObjectId,
    pathID: string,
    user_ID: ObjectId
  ) {
    const materials = await Material.find({
      pathID: pathID,
      compStatus: "NOT_STARTED",
      user_ID: user_ID,
      journey_ID: journeyId,
    });
    return materials.length > 0;
  }

  static async answerMaterial(
    user: WithId<IUser>,
    input: {
      materialId: ObjectId;
      answer: any;
    }
  ): Promise<{
    next: "CREATING_NEW" | "INITIAL_END" | "INITIAL_CONTINUE";
    newPath: string | null;
    newMaterial: ObjectId | null;
  }> {

    const material = await Material.findById(input.materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    const journey = await Journey.findById(material.journey_ID);
    if (!journey) {
      throw new Error("Journey not found");
    }

    const flowCtx = new MaterialFlowContext({
      journey,
      pathID: material.pathID,
      user,
      answeredMaterial: material,
      rawAnswer: input.answer,
    });

    await BaseMaterialTypeHelper.prepareAnswer(new AnswerContext(flowCtx));

    const isInitial = journey.paths[material.pathID].type === "INITIAL";

    const ctx = new AnalyzingContext(flowCtx);

    this.analyze(ctx);

    if (isInitial) {
      return this.handleInitialAnswer(ctx);
    }

    FeedbackHelper.handleAnswer(new FeedbackContext(flowCtx));

    const newMaterial = await this.createGeneratingMaterial({
      journey: journey,
      pathID: material.pathID,
    });

    MaterialGenerationHelper.gen(
      new MaterialGenerationContext({
        reason: "path",
        flow: flowCtx,
        requiredMaterial: {
          type: material.details!.type,
          material: newMaterial,
        },
      })
    );

    return {
      next: "CREATING_NEW",
      newPath: null,
      newMaterial: newMaterial._id,
    };
  }

  static async analyze(ctx: AnalyzingContext) {
    const pathId = ctx.flow.pathID;
    try {
      if (this.analyzingMaterials[pathId]) {
        const existingCtx = this.analyzingMaterials[pathId];
        await existingCtx.waitUntil("completed");
      }

      ctx.startGeneration();

      const prompt = await ctx.getAnalysisPrompt();

      const aiRes = await new ChatGeneration(
        "progress",
        prompt,
        ctx
      ).generate();

      const level = undefinedOrValue(aiRes.level, null);

      const pathUpdates: any = {};

      if (level) {
        Object.keys(level).forEach((key) => {
          pathUpdates[`progress.level.${key}` as string] = level![
            key as keyof BrocaTypes.Progress.PathLevel
          ] as any;
        });
      }

      const observations = undefinedOrValue(aiRes.observations, null);

      if (observations) {
        const updatedObservations = this.updateArray(
          ctx.flow.journey.progress.observations,
          observations
        );

        pathUpdates["progress.observations"] = updatedObservations;
      }

      const strongPoints = undefinedOrValue(aiRes.strongPoints, null);

      if (strongPoints) {
        const updatedStrongPoints = this.updateArray(
          ctx.flow.journey.progress.strongPoints,
          strongPoints
        );

        pathUpdates["progress.strongPoints"] = updatedStrongPoints;
      }

      const weakPoints = undefinedOrValue(aiRes.weakPoints, null);

      if (weakPoints) {
        const updatedWeakPoints = this.updateArray(
          ctx.flow.journey.progress.weakPoints,
          weakPoints
        );

        pathUpdates["progress.weakPoints"] = updatedWeakPoints;
      }

      if (Object.keys(pathUpdates).length > 0) {
        await ctx.updateJourney({
          $set: pathUpdates,
        });
      }

      await ctx.complete();
    } catch (e) {
      ctx.addError(e as Error);
      throw e;
    } finally {
      delete this.analyzingMaterials[pathId];
    }
  }
}
