import { JourneyHelper } from "../helpers/journey";
import { paginate } from "../helpers/pagination";
import {
  Journey,
  Material,
  ConversationTurn,
  InitialTemplate,
  UserAnswer,
  UserDoc,
  AiFeedback,
  ModelsSet,
  IUserDoc,
  IMaterial,
  IJourney,
} from "../models/_index";
import { AppContext, AppResolvers, checkAuth } from "../utils/types";
import ApiError from "../utils/error";
import { DbHelper, ObjectId, WithGQLID, WithId } from "../helpers/db";
import { TermManager } from "../helpers/gen/term";
import { DocumentationManager } from "../helpers/gen/documentation";
import { FeedbackHelper } from "../helpers/gen/materials/feedback";
import { ProgressHelper } from "../helpers/gen/materials/progress";
import { ConversationManager } from "../helpers/gen/materials/conversation";
import { BrocaTypes } from "../types";
import { GqlTypes } from "../utils/gql-types";
import { MaterialGenerationHelper } from "../helpers/gen/materials/generation";

export const userQueries: GqlTypes.UserQueryResolvers = {
  my_journeys: async (_, args, context) => {
    checkAuth(context);

    const res = await paginate<WithGQLID<IJourney>>(
      "journeys",
      {
        limit: 1000,
      },
      {
        additionalQuery: {
          user_ID: context.user!._id,
        },
      }
    );

    return res;
  },
  journey: async (_, args, context) => {
    checkAuth(context);

    const res = await Journey.findById(args.id);

    if (!res) {
      throw new Error("Journey not found");
    }

    return res;
  },
  material: async (_, args, context) => {
    checkAuth(context);

    const gen =
      MaterialGenerationHelper.generatingMaterials[args.id.toHexString()];

    if (gen) {
      await gen.waitUntil("generated");
    }

    const res = await Material.findById(args.id);

    return res;
  },

  conversation_turns: async (_, args, context) => {
    checkAuth(context);

    if (!args.materialId) {
      throw new Error("Material ID is required");
    }

    const res = await ConversationTurn.find(
      {
        material_ID: args.materialId,
      },
      {
        sort: {
          createdAt: -1,
        },
      }
    );

    return res;
  },

  path_materials: async (_, args, context) => {
    checkAuth(context);

    const r = await paginate<WithGQLID<IMaterial>>(
      "materials",
      args.pagination,
      {
        additionalQuery: {
          pathID: args.pathID,
          journey_ID: args.journeyId,
        },
      }
    );

    return r;
  },

  parsed_units: async (_, args, context) => {
    checkAuth(context);

    const text = args.text;
    const journeyId = args.journeyId;

    const res = await TermManager.resolve(text, journeyId);

    return res;
  },
  documentation: async (_, args, context) => {
    checkAuth(context);

    const journey = await Journey.findById(args.input.journeyId);
    if (!journey) {
      throw new Error("Journey not found");
    }

    const res = await DocumentationManager.findOrCreateDocumentation({
      journey,
      title: args.input.title,
      searchTerm: args.input.searchTerm,
    });

    return {
      __typename: "UserDoc",
      ...res,
    };
  },
  journey_docs: async (_, args, context) => {
    checkAuth(context);

    const res = await paginate<WithGQLID<IUserDoc>>(
      "user-doc",
      args.pagination,
      {
        additionalQuery: {
          journey_ID: args.journeyId,
          user_ID: context.user!._id,
        },
      }
    );

    return res;
  },
  material_feedbacks: async (_, args, context) => {
    checkAuth(context);

    const materialId = args.materialId;

    if (FeedbackHelper.gettingFeedback[materialId.toHexString()]) {
      const gens = FeedbackHelper.gettingFeedback[materialId.toHexString()];

      await gens.waitUntil("completed");
    }

    return await AiFeedback.find({
      material_ID: materialId,
    });
  },
  model_sets: async (_, args, context) => {
    checkAuth(context);

    const res = await ModelsSet.find({});

    return {
      items: res,
      pageInfo: {
        hasNextPage: false,
        nextCursor: null,
      },
    };
  },
};

function modifyJourney(journey: WithId<IJourney>) {
  const paths: BrocaTypes.Progress.Path[] = [];

  for (const [key, value] of Object.entries(journey.paths)) {
    paths.push({
      ...value,
      // @ts-ignore
      id: key,
    });
  }

  const res = {
    ...journey,
    paths,
  };

  return res;
}

export const userMutations: GqlTypes.UserMutationResolvers = {
  create_journey: async (_, args, context) => {
    checkAuth(context);

    const res = await JourneyHelper.createJourney(context.user!, args.input);

    // @ts-ignore
    res.journey = modifyJourney(res.journey);

    return res;
  },
  answer_material: async (_, args, context) => {
    checkAuth(context);

    try {
      const res = await ProgressHelper.answerMaterial(
        context.user!,
        args.input
      );
      return res;
    } catch (e) {
      console.error(e);
      throw ApiError.e500("Failed to answer material");
    }
  },
  // regenerate_material: async (_, args, context) => {
  //   checkAuth(context);
  //   const res = await ProgressHelper.regenerateMaterial(args.materialId);
  //   return res;
  // },
  // prepare_material: async (_, args, context) => {
  //   checkAuth(context);
  //   const material = await Material.findById(args.materialId);
  //   if (!material) {
  //     throw new Error("Material not found");
  //   }
  //   const journey = await Journey.findById(material.journey_ID);
  //   if (!journey) {
  //     throw new Error("Journey not found");
  //   }
  //   const res = await MaterialHelper.prepareMaterial({
  //     materialId: args.materialId,
  //     language: journey.to,
  //   });
  //   return res;
  // },
  // gen_material: async (_, args, context) => {
  //   checkAuth(context);
  //   const { journeyId, pathId, type } = args.input;
  //   const journey = await Journey.findById(journeyId);
  //   if (!journey) {
  //     throw new Error("Journey not found");
  //   }
  //   const path = await UserPath.findById(pathId);
  //   if (!path) {
  //     throw new Error("Path not found");
  //   }
  //   const res = await MaterialHelper.testGenMaterial({
  //     journey: journey,
  //     userPath: path,
  //     requiredMaterials: [{ type: type }],
  //   });
  //   return res;
  // },
  // start_conversation: async (_, args, context) => {
  //   checkAuth(context);
  //   const res = await MaterialHelper.createConversation(args.input);
  //   return res;
  // },
  // speak: async (_, args, context) => {
  //   checkAuth(context);
  //   const conversationTurn = await ConversationTurn.findById(args.id);
  //   if (!conversationTurn) {
  //     throw new Error("Conversation turn not found");
  //   }
  //   await AzureVoice.speak(conversationTurn.ssml!, "en-US-DavisNeural");
  //   return true;
  // },
  add_user_input: async (_, args, context) => {
    checkAuth(context);

    const res = await ConversationManager.addUserInput(
      context.user!,
      args.input
    );

    return res;
  },
  // unUnderstoodQuestions: async (_, args, context) => {
  //   checkAuth(context);
  //   const { pathId, journeyId } = args;
  //   const path = await UserPath.findById(pathId);
  //   if (!path) {
  //     throw new Error("Path not found");
  //   }
  //   const materials = await MaterialHelper.createMaterialForInitial({
  //     journeyId,
  //     pathId,
  //   });
  //   if (!materials) {
  //     throw new Error("Failed to create initial material");
  //   }
  //   return {
  //     __typename: "StartInitialResponse",
  //     path,
  //     materials,
  //   };
  // },
  reset_journey: async (_, args, context) => {
    checkAuth(context);

    await Material.deleteMany({
      journey_ID: args.id,
    });

    await Journey.findByIdAndDelete(args.id);

    await DbHelper.cacheHelper!.deletePattern("ula:*");

    return true;
  },
  delete_journey: function (
    parent: any,
    args: { id: ObjectId },
    context: AppContext,
    info: any
  ): Promise<boolean> {
    throw new Error("Function not implemented.");
  },
  update_journey: function (
    parent: any,
    args: { id: ObjectId; input: GqlTypes.User.UpdateJourneyInput },
    context: AppContext,
    info: any
  ): Promise<WithGQLID<IJourney>> {
    throw new Error("Function not implemented.");
  },
  create_path: function (
    parent: any,
    args: GqlTypes.User.CreatePathInput,
    context: AppContext,
    info: any
  ): Promise<GqlTypes.User.CreatePathResponse> {
    throw new Error("Function not implemented.");
  },
  clear_conversation: function (
    parent: any,
    args: { materialId: ObjectId },
    context: AppContext,
    info: any
  ): Promise<boolean> {
    throw new Error("Function not implemented.");
  },
  prepare_material: function (
    parent: any,
    args: { materialId: ObjectId },
    context: AppContext,
    info: any
  ): Promise<WithGQLID<IMaterial>> {
    throw new Error("Function not implemented.");
  },
  regenerate_material: function (
    parent: any,
    args: { materialId: ObjectId },
    context: AppContext,
    info: any
  ): Promise<WithGQLID<IMaterial>> {
    throw new Error("Function not implemented.");
  },
  gen_material: function (
    parent: any,
    args: GqlTypes.User.GenMaterialInput,
    context: AppContext,
    info: any
  ): Promise<WithGQLID<IMaterial>> {
    throw new Error("Function not implemented.");
  },
};

export const userSubscriptions: AppResolvers = {
  start_conversation: {
    subscribe: async function* (_, args, context) {
      checkAuth(context);

      const res = ConversationManager.startConversation({
        ...args,
        user: context.user!,
      });

      for await (const value of res) {
        yield {
          start_conversation: {
            turn:
              value.turn === null
                ? null
                : {
                    ...value.turn,
                    id: value.turn._id.toHexString(),
                  },
            nextTurn: value.nextTurn,
          },
        };
      }
    },
  },
};

export const userResolvers: AppResolvers = {
  MaterialDetails: {
    __resolveType: (obj: BrocaTypes.Material.MaterialDetails) => {
      if (!obj) return null;
      const resolvedType = BrocaTypes.Material.materialDetailsMapping[obj.type];

      return resolvedType;
    },
  },

  QuestionItem: {
    hasPicture: (parent) => {
      return !!parent.pictureId || !!parent.picturePrompt;
    },
  },
  QuizPreludeItem: {
    hasPicture: (parent) => {
      return !!parent.pictureId || !!parent.picturePrompt;
    },
  },
  StoryPart: {
    hasPicture: (parent) => {
      return !!parent.pictureId || !!parent.picturePrompt;
    },
  },
  Journey: {
    paths: (parent) => {
      if (!parent.paths) return [];
      if (Array.isArray(parent.paths)) {
        return parent.paths;
      }

      const res: BrocaTypes.Progress.Path[] = [];

      for (const [key, value] of Object.entries(parent.paths)) {
        res.push({
          // @ts-ignore
          ...value,
          id: key,
        });
      }

      return res;
    },
  },
  Material: {
    type: (parent) => {
      return parent.details?.type ?? "UNKNOWN";
    },
    answer: async (parent) => {
      return await UserAnswer.findOne({
        material_ID: parent._id,
      });
    },
    unseenAiFeedbacks: async (parent) => {
      return await AiFeedback.count({
        material_ID: parent._id,
        seen: false,
      });
    },
  },
};
