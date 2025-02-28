import { ObjectId, WithId } from "mongodb";
import {
  IJourney,
  IMaterial,
  IUser,
  Journey,
  Material,
  ModelsSet,
} from "../models/_index";
import ApiError from "../utils/error";
import { AIModel } from "../types/ctx";
import { ProgressHelper } from "./gen/materials/progress";
import { GqlTypes } from "../utils/gql-types";
import { WithGQLID } from "./db";

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
    user: WithId<IUser>,
    input: GqlTypes.User.CreateJourneyInput
  ): Promise<GqlTypes.User.CreateJourneyResponse> {
    const created: {
      journey?: WithGQLID<IJourney> | null;
      materials?: WithGQLID<IMaterial>[] | null;
    } = {};

    async function removeCreated() {
      const promises = [];
      if (created.journey) {
        promises.push(Journey.findByIdAndDelete(created.journey._id));
      }
      if (created.materials) {
        for (const material of created.materials) {
          promises.push(Material.findByIdAndDelete(material._id));
        }
      }
      await Promise.all(promises);
    }

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

      created.journey = await Journey.insertOne({
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
        paths: {
          initial: {
            name: "Initial path",
            type: "INITIAL",
            isMain: true,
            isActive: true,
          },
        },
        progress: {
          completedActivities: 0,
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
          observations: [],
        },
      });

      if (!created.journey) {
        await removeCreated();
        throw ApiError.e500("Failed to create journey");
      }

      created.materials = await ProgressHelper.getInitialMaterials({
        journeyId: created.journey._id,
        user: user,
      });

      if (!created.materials) {
        await removeCreated();
        throw ApiError.e500("Failed to create initial material");
      }

      return {
        journey: created.journey,
        materials: created.materials,
      };
    } catch (e) {
      await removeCreated();
      console.error(e);
      throw ApiError.e500("Failed to create journey");
    }
  }
}
