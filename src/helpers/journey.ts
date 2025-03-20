import { ObjectId, WithId } from "mongodb";
import {
  IJourney,
  IMaterial,
  IUser,
  Journey,
  Material,
  ModelsSet,
  Stage,
} from "../models/_index";
import ApiError from "../utils/error";
import { AIModel } from "../types/ctx";
import { ProgressHelper } from "./gen/materials/progress";
import { GqlTypes } from "../utils/gql-types";
import { WithGQLID } from "./db";
import { MaterialGenerationHelper } from "./gen/materials/generation";
import {
  MaterialFlowContext,
  MaterialGenerationContext,
} from "./gen/materials/ctx";
import { BrocaTypes } from "../types";
import { randomString } from "../utils/random";
import { log } from "./log";
import { LanguageHelper } from "./language";

export class JourneyHelper {
  // static async createUserInitialPath(journeyId: ObjectId) {
  //   const journey = await Journey.findById(journeyId);
  //   if (!journey) {
  //     throw ApiError.e404("Journey not found");
  //   }
  //   const userPath = await UserPath.insertOne({
  //     journey_ID: journeyId,
  //     user_ID: journey.user_ID,
  //     type: "INITIAL",
  //     progress: {
  //       completedActivities: 0,
  //       level: {
  //         grammar: -1,
  //         listening: -1,
  //         reading: -1,
  //         speaking: -1,
  //         vocabulary: -1,
  //         writing: -1,
  //       },
  //       strongPoints: [],
  //       weakPoints: [],
  //       observations: [],
  //     },
  //     description: "Initial path",
  //     name: "Initial path",
  //     isActive: true,
  //     lastStudyDate: Date.now(),
  //     isMain: true,
  //   });

  //   return userPath;
  // }

  static async updateJourney(journeyId: ObjectId, update: Partial<IJourney>) {
    const journey = await Journey.findByIdAndUpdate(journeyId, {
      $set: update,
    });

    return journey;
  }

  // static async updateUserPath(
  //   userPathId: ObjectId,
  //   update: Partial<IUserPath> & { "progress.level"?: PathLevel }
  // ) {
  //   const userPath = await UserPath.findByIdAndUpdate(userPathId, {
  //     $set: update,
  //   });

  //   return userPath;
  // }

  static async createJourney(
    user: WithGQLID<IUser>,
    input: GqlTypes.User.CreateJourneyInput
  ): Promise<WithGQLID<IJourney>> {
    let created: WithGQLID<IJourney> | null = null;

    const modelSet = await ModelsSet.findById(input.modelSet);

    if (!modelSet) {
      throw ApiError.e400("Invalid model set");
    }

    try {
      if (
        !AIModel.hasModels({
          chat: [modelSet.chatModel],
          img: [modelSet.imgModel],
          tts: [modelSet.ttsModel],
          stt: [modelSet.sttModel],
        })
      ) {
        throw ApiError.e400("Invalid AI model");
      }

      if (!LanguageHelper.getSupportedLanguageByTag(input.to)) {
        throw ApiError.e400("Invalid target language");
      }

      created = await Journey.insertOne({
        user_ID: user._id,
        avatar: input.avatar.hsl,
        lastStudyDate: Date.now(),
        chatModel: modelSet.chatModel,
        imageGenModel: modelSet.imgModel,
        ttsModel: modelSet.ttsModel,
        sttModel: modelSet.sttModel,
        name: input.name,
        status: "active",
        to: input.to,
        from: input.from,
        progress: {
          level: {
            grammar: -1,
            listening: -1,
            reading: -1,
            speaking: -1,
            vocabulary: -1,
            writing: -1,
          },
          strongPoints: [],
          weakPoints: [],
          general: [],
        },
      });

      if (!created) {
        throw ApiError.e500("Failed to create journey");
      }

      const j = await ProgressHelper.analyzeInitialAnswers(
        created,
        user,
        input
      );

      await ProgressHelper.generateStage(j, user, false);

      return j;
    } catch (e) {
      log.error(e);
      throw ApiError.e500("Failed to create journey");
    }
  }
}
