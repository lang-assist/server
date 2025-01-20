import { ObjectId, WithId } from "mongodb";
import {
  IJourney,
  IMaterial,
  IUser,
  IUserPath,
  Journey,
  Material,
  UserPath,
} from "../models/_index";
import ApiError from "../utils/error";
import { PathLevel, SupportedLocale } from "../utils/types";
import { AIModel } from "./ai/base";
import { MaterialHelper } from "./material";

export class JourneyHelper {
  static async createUserInitialPath(journeyId: ObjectId) {
    const journey = await Journey.findById(journeyId);
    if (!journey) {
      throw ApiError.e404("Journey not found");
    }
    const userPath = await UserPath.insertOne({
      journey_ID: journeyId,
      user_ID: journey.user_ID,
      type: "INITIAL",
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
      description: "Initial path",
      name: "Initial path",
      isActive: true,
      lastStudyDate: Date.now(),
      isMain: true,
    });

    return userPath;
  }

  static async updateJourney(journeyId: ObjectId, update: Partial<IJourney>) {
    const journey = await Journey.findByIdAndUpdate(journeyId, {
      $set: update,
    });

    return journey;
  }

  static async updateUserPath(
    userPathId: ObjectId,
    update: Partial<IUserPath> & { "progress.level"?: PathLevel }
  ) {
    const userPath = await UserPath.findByIdAndUpdate(userPathId, {
      $set: update,
    });

    return userPath;
  }

  static async createJourney(
    user: WithId<IUser>,
    input: {
      name: string;
      model: string;
      to: SupportedLocale;
      avatar: {
        hsl: string;
      };
    }
  ) {
    const created: {
      journey?: WithId<IJourney> | null;
      path?: WithId<IUserPath> | null;
      materials?: WithId<IMaterial>[] | null;
    } = {};

    async function removeCreated() {
      const promises = [];
      if (created.journey) {
        promises.push(Journey.findByIdAndDelete(created.journey._id));
      }
      if (created.path) {
        promises.push(UserPath.findByIdAndDelete(created.path._id));
      }
      if (created.materials) {
        for (const material of created.materials) {
          promises.push(Material.findByIdAndDelete(material._id));
        }
      }
      await Promise.all(promises);
    }

    try {
      const model = AIModel.models[input.model];
      if (!model) {
        throw ApiError.e400("Invalid AI model");
      }

      created.journey = await Journey.insertOne({
        user_ID: user._id,
        avatar: input.avatar.hsl,
        lastStudyDate: Date.now(),
        aiModel: input.model,
        name: input.name,
        status: "active",
        to: input.to,
      });

      if (!created.journey) {
        await removeCreated();
        throw ApiError.e500("Failed to create journey");
      }

      created.path = await JourneyHelper.createUserInitialPath(
        created.journey._id
      );

      if (!created.path) {
        await removeCreated();
        throw ApiError.e500("Failed to create initial path");
      }

      created.materials = await MaterialHelper.createMaterialForInitial({
        journeyId: created.journey._id,
        pathId: created.path._id,
      });

      if (!created.materials) {
        await removeCreated();
        throw ApiError.e500("Failed to create initial material");
      }

      return {
        __typename: "CreateJourneyResponse",
        journey: created.journey,
        path: created.path,
        materials: created.materials,
      };
    } catch (e) {
      await removeCreated();
      console.error(e);
      throw ApiError.e500("Failed to create journey");
    }
  }
}
