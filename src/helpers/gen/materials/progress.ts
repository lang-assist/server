import {
  DictItem,
  Docs,
  IJourney,
  IStage,
  IStagePart,
  IUser,
  Journey,
  Material,
  SentenceItem,
  Stage,
  StagePart,
  UserActions,
} from "../../../models/_index";
import { ObjectId, WithId } from "mongodb";
import { BaseMaterialTypeHelper } from "./type-helpers/base";
import { FeedbackHelper } from "./feedback";

import {
  AnalyzingContext,
  AnswerContext,
  FeedbackContext,
  MaterialFlowContext,
  MaterialGenerationContext,
  StageGeneratingContext,
} from "./ctx";
import { MaterialGenerationHelper } from "./generation";
import { BrocaTypes } from "../../../types";
import {
  ChatGeneration,
  ImageGeneration,
  TranscriptionGeneration,
} from "../../ai";
import { undefinedOrValue } from "../../../utils/validators";
import { WithGQLID } from "../../db";
import { StageDocumentationManager } from "../documentation";
import { msg, PromptBuilder, withTag } from "../../../utils/prompter";
import {
  describeMaterial,
  instructions,
  journeySummary,
  progressSummary,
  summarizePronunciationAnalysis,
} from "../../prompts";
import { GqlTypes } from "../../../utils/gql-types";
import {
  ChatGenerationContext,
  ChatGenerationContextWithGlobalAssistant,
} from "../../ai/chat/base";
import { AIModel } from "../../../types/ctx";
import { AIModels } from "../../../utils/constants";
import { LanguageHelper } from "../../language";
import { StorageService } from "../../storage";
import { GraphemeHelper } from "../../grapheme";

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

    let removedCount = 0;

    if (updates.remove) {
      for (const index of updates.remove) {
        array.splice(index - removedCount, 1);
        removedCount++;
      }
    }

    if (updates.replace) {
      for (const replace of updates.replace) {
        array[replace.index - removedCount] = replace.replace;
      }
    }

    return array;
  }

  public static async createGeneratingMaterial(args: {
    type: BrocaTypes.Material.MaterialType;
    improves: string[];
    measures: string[];
    instructions: string;
    journey: WithId<IJourney>;
    stage: WithId<IStage>;
    part: ObjectId;
  }) {
    const mat = await Material.insertOne({
      compStatus: "NOT_STARTED",
      convStatus: "NOT_STARTED",
      genStatus: "CREATING",
      feedbackStatus: "NOT_STARTED",
      journey_ID: args.journey._id,
      user_ID: args.journey.user_ID,
      stage_ID: args.stage._id,
      part_ID: args.part,
      type: args.type,
      improves: args.improves,
      measures: args.measures,
      instructions: args.instructions,
    });

    if (!mat) {
      throw new Error("Material not created");
    }

    return mat;
  }

  // static async getInitialMaterials(input: {
  //   journeyId: ObjectId;
  //   user: WithId<IUser>;
  // }): Promise<WithGQLID<IMaterial>[]> {
  //   const journey = await Journey.findById(input.journeyId);
  //   if (!journey) {
  //     throw new Error("Journey not found");
  //   }

  //   const initialTemplate = await InitialTemplate.findOne({
  //     language: journey.to,
  //     aiModel: journey.chatModel,
  //   });

  //   if (!initialTemplate) {
  //     return await ProgressHelper.createMaterialForInitial(input);
  //   }

  //   const materials: WithGQLID<IMaterial>[] = [];

  //   for (const material of initialTemplate.materials) {
  //     const inserted = await Material.insertOne({
  //       journey_ID: journey._id,
  //       pathID: "initial",
  //       user_ID: journey.user_ID,
  //       compStatus: "NOT_STARTED",
  //       genStatus: "COMPLETED",
  //       convStatus: "NOT_STARTED",
  //       feedbackStatus: "NOT_STARTED",
  //       metadata: material.metadata,
  //       details: material.details,
  //     });

  //     if (inserted) {
  //       materials.push(inserted);
  //     }
  //   }

  //   return materials;
  // }

  // static async createMaterialForInitial(input: {
  //   journeyId: ObjectId;
  //   user: WithId<IUser>;
  // }): Promise<WithGQLID<IMaterial>[]> {
  //   const journey = await Journey.findById(input.journeyId);
  //   if (!journey) {
  //     throw new Error("Journey not found");
  //   }

  //   let path = journey.paths.initial;

  //   if (!path) {
  //     throw new Error("Path not found");
  //   }

  //   const flowCtx = new MaterialFlowContext({
  //     journey,
  //     pathID: "initial",
  //     user: input.user,
  //   });

  //   const ctxs = [
  //     new MaterialGenerationContext({
  //       reason: "initial",
  //       flow: flowCtx,
  //       requiredMaterial: {
  //         type: "QUIZ",
  //         description:
  //           "This is the initial quiz. Before the user starts to learn, we don't have any information about user level in the language. So we need to ask questions to determine the user level. For this, we will ask only 2 questions: TEXT_INPUT_WRITE, RECORD. This allows user to answer generically and we can determine the user level.",
  //       },
  //     }),
  //     new MaterialGenerationContext({
  //       reason: "initial",
  //       flow: flowCtx,
  //       requiredMaterial: {
  //         type: "CONVERSATION",
  //       },
  //     }),
  //     new MaterialGenerationContext({
  //       reason: "initial",
  //       flow: flowCtx,
  //       requiredMaterial: {
  //         type: "STORY",
  //       },
  //     }),
  //   ];

  //   const template: BrocaTypes.Material.Material[] = [];

  //   const promises: Promise<void>[] = [];

  //   for (const ctx of ctxs) {
  //     MaterialGenerationHelper.gen(ctx);
  //     promises.push(ctx.waitUntil("completed"));
  //   }

  //   await Promise.all(promises);

  //   for (const ctx of ctxs) {
  //     template.push({
  //       metadata: ctx.requiredMaterial.metadata!,
  //       details: ctx.requiredMaterial.details!,
  //     });
  //   }

  //   await InitialTemplate.insertOne({
  //     language: journey.to,
  //     level: 1,
  //     materials: template,
  //     aiModel: journey.chatModel,
  //   });

  //   await Material.deleteMany({
  //     journey_ID: journey._id,
  //     pathID: "initial",
  //     user_ID: journey.user_ID,
  //   });

  //   const materials: WithGQLID<IMaterial>[] = [];

  //   for (const material of template) {
  //     const inserted = await Material.insertOne({
  //       journey_ID: journey._id,
  //       pathID: "initial",
  //       user_ID: journey.user_ID,
  //       compStatus: "NOT_STARTED",
  //       genStatus: "COMPLETED",
  //       convStatus: "NOT_STARTED",
  //       feedbackStatus: "NOT_STARTED",
  //       metadata: material.metadata,
  //       details: material.details,
  //     });
  //     if (inserted) {
  //       materials.push(inserted);
  //     }
  //   }

  //   return materials;
  // }

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

  // /**
  //  * true indicates that path is completed
  //  *
  //  */
  // static async handleInitialAnswer(ctx: AnalyzingContext): Promise<{
  //   next: "CREATING_NEW" | "INITIAL_END" | "INITIAL_CONTINUE";
  //   newPath: string | null;
  //   newMaterial: ObjectId | null;
  // }> {
  //   try {
  //     const hasUnAnsweredMaterials = await this.hasUnAnsweredMaterials(
  //       ctx.flow.journey._id,
  //       ctx.flow.pathID,
  //       ctx.flow.user._id
  //     );

  //     if (!hasUnAnsweredMaterials) {
  //       await ctx.waitUntil("completed");

  //       const newPathId = randomString(24);

  //       await ctx.updateJourney({
  //         $set: {
  //           "paths.initial.isActive": false,
  //           "paths.initial.isMain": false,
  //           [`paths.${newPathId}`]: {
  //             isActive: true,
  //             isMain: true,
  //             type: "GENERAL",
  //             name: "General",
  //           },
  //         },
  //       });

  //       ctx.flow.pathID = newPathId;

  //       const ctxs = [
  //         new MaterialGenerationContext({
  //           reason: "path",
  //           flow: ctx.flow,
  //           requiredMaterial: {
  //             type: "QUIZ",
  //             material: await this.createGeneratingMaterial({
  //               journey: ctx.flow.journey,
  //               pathID: newPathId,
  //             }),
  //           },
  //         }),
  //         new MaterialGenerationContext({
  //           reason: "path",
  //           flow: ctx.flow,
  //           requiredMaterial: {
  //             type: "CONVERSATION",
  //             material: await this.createGeneratingMaterial({
  //               journey: ctx.flow.journey,
  //               pathID: newPathId,
  //             }),
  //           },
  //         }),
  //         new MaterialGenerationContext({
  //           reason: "path",
  //           flow: ctx.flow,
  //           requiredMaterial: {
  //             type: "STORY",
  //             material: await this.createGeneratingMaterial({
  //               journey: ctx.flow.journey,
  //               pathID: newPathId,
  //             }),
  //           },
  //         }),
  //       ];

  //       for (const ctx of ctxs) {
  //         MaterialGenerationHelper.gen(ctx);
  //       }

  //       return {
  //         next: "INITIAL_END",
  //         newPath: newPathId,
  //         newMaterial: null,
  //       };
  //     } else {
  //       return {
  //         next: "INITIAL_CONTINUE",
  //         newPath: null,
  //         newMaterial: null,
  //       };
  //     }
  //   } catch (e) {
  //     throw e;
  //   }
  // }

  // static async hasUnAnsweredMaterials(
  //   journeyId: ObjectId,
  //   pathID: string,
  //   user_ID: ObjectId
  // ) {
  //   const materials = await Material.find({
  //     pathID: pathID,
  //     compStatus: "NOT_STARTED",
  //     user_ID: user_ID,
  //     journey_ID: journeyId,
  //   });
  //   return materials.length > 0;
  // }

  static async createInitialStage(
    journey: WithGQLID<IJourney>,
    user: WithGQLID<IUser>
  ): Promise<WithGQLID<IStage>> {
    return await this.generateStage(journey, user, true);
  }

  static async answerMaterial(
    user: WithGQLID<IUser>,
    input: {
      stageId: ObjectId;
      partId: ObjectId;
      materialId: ObjectId;
      answer: any;
    }
  ): Promise<{
    currentStage: WithGQLID<IStage> | null;
    newStage: WithGQLID<IStage> | null;
    nextPart: WithGQLID<IStagePart> | null;
  }> {
    const stage = await Stage.findById(input.stageId);
    if (!stage) {
      throw new Error("Stage not found");
    }

    const material = await Material.findById(input.materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    if (!material.stage_ID.equals(stage._id)) {
      throw new Error("Material is not in the stage");
    }

    const journey = await Journey.findById(material.journey_ID);
    if (!journey) {
      throw new Error("Journey not found");
    }

    const part = await StagePart.findById(input.partId);
    if (!part) {
      throw new Error("Part not found");
    }

    const flowCtx = new MaterialFlowContext({
      journey,
      stage,
      user,
      answeredMaterial: material,
      rawAnswer: input.answer,
      part,
    });

    await BaseMaterialTypeHelper.prepareAnswer(new AnswerContext(flowCtx));

    // const isInitial = journey.paths[material.pathID].type === "INITIAL";

    const ctx = new AnalyzingContext(flowCtx);

    let newStage: WithGQLID<IStage> | null = null;
    let currentStage: WithGQLID<IStage> | null = null;

    const analyzing = this.analyze(ctx);

    await analyzing;

    // if (isInitial) {
    //   return this.handleInitialAnswer(ctx);
    // }

    FeedbackHelper.handleAnswer(new FeedbackContext(flowCtx));

    // createdAt asc next 2 parts
    const nextParts = await StagePart.findOne(
      {
        stage_ID: stage._id,
        createdAt: {
          $gt: part.createdAt,
        },
      },
      {
        sort: {
          createdAt: 1,
        },
      }
    );

    if (nextParts) {
      await this._prepareNextPart(nextParts, flowCtx);

      const updatedPart = await StagePart.findByIdAndUpdate(nextParts._id, {
        $set: {
          hidden: false,
        },
      });

      if (!updatedPart) {
        throw new Error("Part not found");
      }

      return {
        newStage: newStage,
        currentStage: currentStage,
        nextPart: updatedPart,
      };
    } else {
      newStage = await this.generateStage(journey, user, false);

      currentStage = await Stage.findByIdAndUpdate(stage._id, {
        $set: {
          status: "COMPLETED",
          levelsOnFinish: ctx.flow.journey.progress.level,
        },
      });

      if (!currentStage) {
        throw new Error("Stage not found");
      }

      ctx.flow.stage = currentStage;
    }

    return {
      newStage: newStage,
      currentStage: currentStage,
      nextPart: null,
    };

    // const newMaterial = await this.createGeneratingMaterial({
    //   journey: journey,
    //   pathID: material.pathID,
    //   type: material!.type,
    // });

    // MaterialGenerationHelper.gen(
    //   new MaterialGenerationContext({
    //     reason: "path",
    //     flow: flowCtx,
    //     requiredMaterial: {
    //       material: newMaterial,
    //     },
    //   })
    // );

    // return {
    //   next: "CREATING_NEW",
    //   newPath: null,
    //   newMaterial: newMaterial._id,
    // };
  }

  static async _prepareNextPart(
    part: WithGQLID<IStagePart>,
    flow: MaterialFlowContext
  ) {
    switch (part.type) {
      case "TEST":
        const mat = part.material.material_ID;
        if (!mat) {
          throw new Error("Material not found");
        }

        const material = await Material.findById(mat);
        if (!material) {
          throw new Error("Material not found");
        }

        const ctx = new MaterialFlowContext({
          journey: flow.journey,
          stage: flow.stage,
          user: flow.user,
          part: part,
        });

        MaterialGenerationHelper.gen(
          new MaterialGenerationContext({
            flow: ctx,
            requiredMaterial: material,
            reason: "next",
          })
        );

        break;

      case "DOCUMENTATION":
        const doc = part.documentation.ref_ID;

        if (!doc) {
          throw new Error("Doc not found");
        }

        const docItem = await Docs.findById(doc);
        if (!docItem) {
          throw new Error("Doc not found");
        }

        const generatedDoc = await StageDocumentationManager.genUserDoc(
          flow.journey,
          part,
          docItem
        );

        if (!generatedDoc) {
          throw new Error("Doc not generated");
        }

        break;
      case "SENTENCES":
      // for (const sentence of part.sentences) {
      //   if (!sentence.ref_ID) {
      //     throw new Error("Sentence item not found");
      //   }

      //   const sentenceItem = await SentenceItem.findById(sentence.ref_ID!);

      //   if (!sentenceItem) {
      //     throw new Error("Sentence item not created");
      //   }

      //   TermManager.resolveSentence(
      //     sentence.sentence,
      //     sentence.instructions,
      //     flow.journey,
      //     sentenceItem
      //   );
      // }

      case "WORDS":
        break;
    }
  }

  static async analyze(ctx: AnalyzingContext) {
    const stageId = ctx.flow.stage._id.toString();
    try {
      if (this.analyzingMaterials[stageId]) {
        const existingCtx = this.analyzingMaterials[stageId];
        await existingCtx.waitUntil("generated");
      }

      ctx.startGeneration();

      const prompt = await ctx.getAnalysisPrompt();

      await new ChatGeneration("analyzer", prompt, ctx).generate(async (m) => {
        if (m.type === "level") {
          ctx.newLevel = m.payload;
        }

        if (m.type === "note") {
          ctx.note = m.payload;
        }

        if (m.type === "observations") {
          ctx.observations = m.payload;
        }

        if (m.type === "successRate") {
          ctx.successRate = m.payload;
        }
      });

      const newLevel = ctx.newLevel;

      const pathUpdates: any = {};

      if (newLevel) {
        Object.keys(newLevel).forEach((key) => {
          pathUpdates[`progress.level.${key}` as string] = newLevel![
            key as keyof BrocaTypes.Progress.PathLevel
          ] as any;
        });
      }

      const general = ctx.observations.general;

      if (general) {
        const updatedGeneral = this.updateArray(
          ctx.flow.journey.progress.general,
          general
        );

        pathUpdates["progress.general"] = updatedGeneral;
      }

      const strongPoints = ctx.observations.strengths;

      if (strongPoints) {
        const updatedStrongPoints = this.updateArray(
          ctx.flow.journey.progress.strongPoints,
          strongPoints
        );

        pathUpdates["progress.strongPoints"] = updatedStrongPoints;
      }

      const weakPoints = ctx.observations.weaknesses;

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

      const note = ctx.note;

      if (note) {
        const updatedNotes = ctx.flow.stage.notes ?? [];

        updatedNotes.push(note);

        await Stage.findByIdAndUpdate(ctx.flow.stage._id, {
          $set: { notes: updatedNotes },
        });
      }

      const successRate = ctx.successRate;

      if (successRate) {
        const behavior = msg();

        behavior.add("User answered material");

        behavior.addKv(
          "Material",
          describeMaterial(ctx.flow.answeredMaterial!, true)
        );

        behavior.addKv("Success Rate", successRate);

        await UserActions.insertOne({
          stage_ID: ctx.flow.stage._id,
          part_ID: ctx.flow.part!._id,
          behavior: behavior.build(),
        });
      }

      await ctx.complete();
    } catch (e) {
      ctx.addError(e as Error);
      throw e;
    } finally {
      delete this.analyzingMaterials[stageId];
    }
  }

  static getGeneratingStage(
    journeyId: ObjectId,
    stageId: ObjectId
  ): StageGeneratingContext | undefined {
    return this._generatingStages[journeyId.toString()]?.[stageId.toString()];
  }

  static _generatingStages: {
    [journeyId: string]: {
      [stageId: string]: StageGeneratingContext;
    };
  } = {};

  static async generateStage(
    journey: WithGQLID<IJourney>,
    user: WithGQLID<IUser>,
    isInitial: boolean
  ) {
    const journeyId = journey._id.toString();

    if (this._generatingStages[journeyId]) {
      const existingCtx = this._generatingStages[journeyId];
      const promises = [];

      for (const stageId in existingCtx) {
        promises.push(existingCtx[stageId].waitUntil("generated"));
      }

      await Promise.all(promises);
    }

    const createdStage = await Stage.insertOne({
      status: "GENERATING",
      journey_ID: journey._id,
      user_ID: user._id,
      levelsOnStart: journey.progress.level,
    });

    if (!createdStage) {
      throw new Error("Stage not created");
    }

    const stageId = createdStage._id.toString();

    const ctx = new StageGeneratingContext(
      new MaterialFlowContext({ journey, stage: createdStage, user }),
      isInitial
    );

    if (!this._generatingStages[journeyId]) {
      this._generatingStages[journeyId] = {};
    }

    this._generatingStages[journeyId][stageId] = ctx;

    this._genStage(ctx).finally(() => {
      delete this._generatingStages[journeyId][stageId];
      if (Object.keys(this._generatingStages[journeyId]).length === 0) {
        delete this._generatingStages[journeyId];
      }
    });

    return createdStage;
  }

  static async _genStage(ctx: StageGeneratingContext) {
    ctx.startGeneration();

    const prompt = await ctx.getStagePrompt();

    await new ChatGeneration("stager", prompt, ctx).generate(async (m) => {
      console.log("STAGER MESSAGE", JSON.stringify(m, null, 2));
      if (m.type === "metadata") {
        ctx.stageMeta = m.payload;
      }

      if (m.type === "stage_part") {
        ctx.stageParts.push(m.payload);
      }
    });

    const newStage = await this._handleNewStage(ctx, ctx.flow.stage);

    ctx.flow.stage = newStage;

    await ctx.complete();

    return newStage;
  }

  static async _handleNewStage(
    ctx: StageGeneratingContext,
    newStageObject: WithGQLID<IStage>
  ): Promise<WithGQLID<IStage>> {
    const { imageId } = await this._prepareNewStage(ctx);

    const newStage = await Stage.findByIdAndUpdate(newStageObject._id, {
      $set: {
        name: ctx.stageMeta?.name,
        description: ctx.stageMeta?.description,
        imagePrompt: ctx.stageMeta?.imagePrompt,
        imageId: imageId,
        status: "GENERATED",
        focusAreas: ctx.stageMeta?.focusAreas,
        focusSkills: ctx.stageMeta?.focusSkills,
        includedTopics: ctx.stageMeta?.includedTopics,
      },
    });

    if (!newStage) {
      throw new Error("Stage not created");
    }

    return newStage;
  }

  static async _prepareNewStage(ctx: StageGeneratingContext): Promise<{
    imageId: string;
  }> {
    const parts = ctx.stageParts;

    const nParts = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      switch (part.type) {
        case "TEST":
          const taskPart = part as BrocaTypes.Progress.StageTestPart;

          const partId = new ObjectId();

          const material = await this.createGeneratingMaterial({
            journey: ctx.flow.journey,
            type: taskPart.content.type,
            improves: taskPart.content.improves ?? [],
            measures: taskPart.content.measures ?? [],
            instructions: taskPart.content.instructions ?? "",
            stage: ctx.flow.stage,
            part: partId,
          });

          const p = await StagePart.insertOne(
            {
              stage_ID: ctx.flow.stage._id,
              type: "TEST",
              explanation: taskPart.explanation,
              material: {
                type: taskPart.content.type,
                improves: taskPart.content.improves ?? [],
                measures: taskPart.content.measures ?? [],
                instructions: taskPart.content.instructions ?? "",
                material_ID: material._id,
              },
              hidden: i !== 0,
            },
            partId
          );

          if (!p) {
            throw new Error("Stage part not created");
          }

          break;

        case "DOCUMENTATION":
          const docPart = part as BrocaTypes.Progress.StageDocumentationPart;

          const docReference = await Docs.insertOne({
            journey_ID: ctx.flow.journey._id,
            user_ID: ctx.flow.user._id,
            genStatus: "NOT_STARTED",
          });

          if (!docReference) {
            throw new Error("Doc reference not created");
          }

          const docP = await StagePart.insertOne({
            stage_ID: ctx.flow.stage._id,
            type: "DOCUMENTATION",
            explanation: docPart.explanation,
            hidden: i !== 0,
            documentation: {
              title: docPart.content.title ?? "",
              instructions: docPart.content.instructions ?? "",
              ref_ID: docReference._id,
            },
          });

          if (!docP) {
            throw new Error("Stage part not created");
          }

          break;

        case "WORDS":
          const dictPart = part as BrocaTypes.Progress.StageDictionaryPart;

          const dictP = await StagePart.insertOne({
            stage_ID: ctx.flow.stage._id,
            type: "WORDS",
            explanation: dictPart.explanation,
            hidden: i !== 0,
            words: dictPart.content.words ?? [],
          });

          if (!dictP) {
            throw new Error("Stage part not created");
          }

          const newWords = [];

          for (let i = 0; i < dictPart.content.words.length; i++) {
            const word = dictPart.content.words[i];

            const dictItem = await DictItem.insertOne({
              part_ID: dictP._id,
              index: i,
              genStatus: "NOT_STARTED",
            });

            if (!dictItem) {
              throw new Error("Dict item not created");
            }

            newWords.push({
              ...word,
              ref_ID: dictItem._id,
            });
          }

          await StagePart.findByIdAndUpdate(dictP._id, {
            $set: {
              words: newWords,
            },
          });

          break;

        case "SENTENCES":
          const sentencePart = part as BrocaTypes.Progress.StageSentencePart;

          const sentenceP = await StagePart.insertOne({
            stage_ID: ctx.flow.stage._id,
            type: "SENTENCES",
            explanation: sentencePart.explanation,
            hidden: i !== 0,
            sentences: sentencePart.content.sentences ?? [],
          });

          if (!sentenceP) {
            throw new Error("Stage part not created");
          }

          const newSentences = [];

          for (let i = 0; i < sentencePart.content.sentences.length; i++) {
            const sentence = sentencePart.content.sentences[i];

            const sentenceItem = await SentenceItem.insertOne({
              part_ID: sentenceP._id,
              index: i,
              genStatus: "NOT_STARTED",
            });

            if (!sentenceItem) {
              throw new Error("Sentence item not created");
            }

            newSentences.push({
              ...sentence,
              ref_ID: sentenceItem._id,
            });
          }

          await StagePart.findByIdAndUpdate(sentenceP._id, {
            $set: {
              sentences: newSentences,
            },
          });

          break;
        case "GRAPHEMES":
          const graphemePart = part as BrocaTypes.Progress.StageGraphemePart;

          const grps: {
            grapheme: string;
            ref_ID?: ObjectId;
            practices?: string[]; // ObjectIds of Materials
            use_cases?: string[]; // ObjectIds of UserDocs
          }[] = [];

          for (let i = 0; i < graphemePart.content.graphemes.length; i++) {
            const grapheme = graphemePart.content.graphemes[i];

            const grp = await GraphemeHelper.getGrapheme(
              grapheme,
              ctx.flow.journey.to
            );

            grps.push({
              grapheme: grp.grapheme,
              ref_ID: grp._id,
            });
          }

          const graphemeP = await StagePart.insertOne({
            stage_ID: ctx.flow.stage._id,
            type: "GRAPHEMES",
            explanation: graphemePart.explanation,
            hidden: i !== 0,
            graphemes: grps,
          });

          if (!graphemeP) {
            throw new Error("Stage part not created");
          }

          break;
      }
    }

    // for (const part of parts) {
    //   switch (part.type) {
    //     case "TASK":
    //       const taskPart = part as BrocaTypes.Progress.StageTaskPart;

    //       const created = await this.createGeneratingMaterial({
    //         journey: ctx.flow.journey,
    //         stage: ctx.flow.stage,
    //         type: taskPart.content.type,
    //         improves: taskPart.content.improves ?? [],
    //         measures: taskPart.content.measures ?? [],
    //         instructions: taskPart.content.instructions ?? "",
    //       });

    //       if (!created) {
    //         throw new Error("Material not created");
    //       }

    //       taskPart.content.id = created._id.toString();

    //       break;

    //     case "DOCUMENTATION":
    //       const docPart = part as BrocaTypes.Progress.StageDocumentationPart;

    //       const docReference = await DocReference.insertOne({
    //         stage_ID: ctx.flow.stage._id,
    //         title: docPart.content.title,
    //         instructions: docPart.content.instructions,
    //       });

    //       if (!docReference) {
    //         throw new Error("Doc reference not created");
    //       }

    //       docPart.content.id = docReference._id.toString();

    //       break;

    //     case "DICTIONARY":
    //     case "SENTENCE":
    //   }
    // }

    // const resources = newStageData.resources;

    // if (resources) {
    //   const docs = resources.docs;

    //   if (docs) {
    //     for (var i = 0; i < docs.length; i++) {
    //       const doc = docs[i];
    //       const docReference = await DocReference.insertOne({
    //         stage_ID: ctx.flow.stage._id,
    //         title: doc.title,
    //         search: doc.search,
    //       });

    //       if (docReference) {
    //         docs[i] = {
    //           reference: docReference._id.toString(),
    //           title: doc.title,
    //           search: doc.search,
    //         };
    //       }
    //     }
    //     resources.docs = docs;
    //   }
    // }

    // if (newStageData.tasks) {
    //   const tasks = newStageData.tasks;

    //   for (var i = 0; i < tasks.materials.length; i++) {
    //     const material = tasks.materials[i];

    //     const mat = await this.createGeneratingMaterial({
    //       journey: ctx.flow.journey,
    //       stage: ctx.flow.stage,
    //       type: material.type,
    //       improves: material.improves ?? [],
    //       measures: material.measures ?? [],
    //       instructions: material.instructions ?? "",
    //     });

    //     if (!mat) {
    //       throw new Error("Material not created");
    //     }

    //     material.id = mat._id.toString();
    //     tasks.materials[i] = material;

    //     const genCtx = new MaterialGenerationContext({
    //       flow: ctx.flow,
    //       requiredMaterial: mat,
    //       reason: "new stage",
    //     });

    //     MaterialGenerationHelper.gen(genCtx);

    //     ctx.addPostGen(genCtx.waitUntil("completed"));
    //   }

    //   newStageData.tasks = tasks;
    // }

    if (ctx.stageMeta?.imagePrompt) {
      const imageId = new ObjectId();
      const gen = new ImageGeneration(ctx.stageMeta.imagePrompt, imageId, ctx, {
        reason: "new stage",
      });

      ctx.addPostGen(gen.generate());

      return {
        imageId: imageId.toString(),
      };
    } else {
      throw new Error("Image prompt not found");
    }
  }

  static async analyzeInitialAnswers(
    journey: WithGQLID<IJourney>,
    user: WithGQLID<IUser>,
    input: GqlTypes.User.CreateJourneyInput
  ): Promise<WithGQLID<IJourney>> {
    const ctx = new _InitialAnalyzerCtx(journey, user, input);

    const builder = new PromptBuilder();

    const i = instructions.analyzer;

    builder.systemMessage(i.content, "assistant", i.version);

    const j = await journeySummary(journey, user);

    builder.userMessage(j);

    const p = progressSummary(journey);

    builder.userMessage(p);

    const req = msg();

    const toName = LanguageHelper.getEnglishName(journey.to);

    const refText = input.referenceText;

    req.add(
      `When the learning journey creating, we asked some questions to the user with a reference text:`
    );

    req.add(
      "1. Read the reference text and repeat it with your own voice or write in your own alphabet."
    );

    req.add(
      "2. Translate the reference text to your own language or describe it in your own words."
    );

    req.add("3. Introduce yourself");

    req.addKv("Reference Text", refText);

    builder.assistantMessage(withTag(req, "context"));

    const ans = msg();

    ans.add("User's answers:");

    if (input.recording) {
      const buffer = await StorageService.getAudio(input.recording);

      const transcription = new TranscriptionGeneration(
        buffer,
        ctx,
        {
          reason: "initial_recording",
        },
        ctx.journey.to
      );

      const transcriptionResult = await transcription.generate();

      if (transcriptionResult.analyze) {
        const analysis = transcriptionResult.analyze;
        const m = msg();

        m.addKv("Transcription", transcriptionResult.transcription);
        m.addKv("Analysis", summarizePronunciationAnalysis(analysis));

        ans.addKv("1. Recording", withTag(m.build(), "user-spoken"));
      } else {
        ans.addKv(
          "1. Recording",
          withTag(transcriptionResult.transcription, "user-spoken")
        );
      }
    } else if (input.repating) {
      ans.addKv("1. Repating", withTag(input.repating, "user-wrote"));
    } else {
      ans.add(`1. User marked they can't read the reference text`);
    }

    if (input.description) {
      ans.addKv("2. Description", withTag(input.description, "user-wrote"));
    } else {
      ans.add(
        `2. User marked they can't read ${toName} or translate the reference text`
      );
    }

    if (input.introduction) {
      ans.addKv("3. Introduction", withTag(input.introduction, "user-wrote"));
    } else {
      ans.add(
        `3. User marked they can't introduce themselves or they can't write in ${toName}`
      );
    }

    builder.userMessage(withTag(ans, "answers"));

    builder.userMessage(
      withTag(
        `Analyze the user's answers and provide observations and levels. No note and success rate needed`,
        "request"
      )
    );

    const gen = new ChatGeneration<"analyzer">("analyzer", builder, ctx);

    await gen.generate(async (m) => {
      console.log("ASSISTANT MESSAGE", JSON.stringify(m, null, 2));
      if (m.type === "level") {
        ctx.newLevel = m.payload;
      }

      if (m.type === "note") {
        // ignore
      }

      if (m.type === "observations") {
        ctx.observations = m.payload;
      }

      if (m.type === "successRate") {
        // ignore
      }
    });

    const newLevel = ctx.newLevel;

    const pathUpdates: any = {};

    if (newLevel) {
      Object.keys(newLevel).forEach((key) => {
        pathUpdates[`progress.level.${key}` as string] = newLevel![
          key as keyof BrocaTypes.Progress.PathLevel
        ] as any;
      });
    }

    const general = ctx.observations.general;

    if (general) {
      const updatedGeneral = this.updateArray(
        journey.progress.general ?? [],
        general
      );

      pathUpdates["progress.general"] = updatedGeneral;
    }

    const strongPoints = ctx.observations.strengths;

    if (strongPoints) {
      const updatedStrongPoints = this.updateArray(
        journey.progress.strongPoints ?? [],
        strongPoints
      );

      pathUpdates["progress.strongPoints"] = updatedStrongPoints;
    }

    const weakPoints = ctx.observations.weaknesses;

    if (weakPoints) {
      const updatedWeakPoints = this.updateArray(
        journey.progress.weakPoints ?? [],
        weakPoints
      );

      pathUpdates["progress.weakPoints"] = updatedWeakPoints;
    }

    let newJourney: WithGQLID<IJourney> | null = journey;

    if (Object.keys(pathUpdates).length > 0) {
      newJourney = await Journey.findByIdAndUpdate(journey._id, {
        $set: pathUpdates,
      });
      if (!newJourney) {
        throw new Error("Journey not updated");
      }
    }

    await ctx.complete();

    return newJourney;
  }
}

class _InitialAnalyzerCtx extends ChatGenerationContextWithGlobalAssistant {
  public get language(): string {
    return this.journey.to;
  }

  toJSON() {
    return {
      journey: this.journey._id,
      user: this.user._id,
      input: this.input,
    };
  }

  constructor(
    public readonly journey: WithGQLID<IJourney>,
    public readonly user: WithGQLID<IUser>,
    public readonly input: GqlTypes.User.CreateJourneyInput
  ) {
    super("analyzer", "initial");
  }

  public get chatModel() {
    return this.journey.chatModel as keyof typeof AIModels.chat;
  }

  public get sttModel() {
    return this.journey.sttModel as keyof typeof AIModels.stt;
  }

  public newLevel: BrocaTypes.Progress.PathLevel | null = null;
  public observations: {
    general?: BrocaTypes.Progress.AIObservationEdit;
    strengths?: BrocaTypes.Progress.AIObservationEdit;
    weaknesses?: BrocaTypes.Progress.AIObservationEdit;
  } = {};
}
