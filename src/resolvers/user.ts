import { JourneyHelper } from "../helpers/journey";
import { paginate } from "../helpers/pagination";
import {
  Journey,
  Material,
  ConversationTurn,
  UserAnswer,
  UserDoc,
  AiFeedback,
  ModelsSet,
  IUserDoc,
  IMaterial,
  IJourney,
  Stage,
  IStage,
  IStagePart,
} from "../models/_index";
import { AppContext, AppResolvers, checkAuth } from "../utils/types";
import ApiError from "../utils/error";
import { DbHelper, ObjectId, WithGQLID, WithId } from "../helpers/db";
import { TermManager } from "../helpers/gen/term";
import { FeedbackHelper } from "../helpers/gen/materials/feedback";
import { ProgressHelper } from "../helpers/gen/materials/progress";
import { ConversationManager } from "../helpers/gen/materials/conversation";
import { BrocaTypes } from "../types";
import { GqlTypes } from "../utils/gql-types";
import { MaterialGenerationHelper } from "../helpers/gen/materials/generation";
import { MaterialFlowContext } from "../helpers/gen/materials/ctx";
import { MaterialGenerationContext } from "../helpers/gen/materials/ctx";
import { COLLECTIONS } from "../utils/constants";
import { GlobalDocumentationManager } from "../helpers/gen/documentation";
import { LanguageHelper } from "../helpers/language";
import { LocaleHelper } from "../helpers/locale";

export const userQueries: GqlTypes.UserQueryResolvers = {
  supported_languages: async (_, args, context) => {
    checkAuth(context);

    const res = LanguageHelper.getSupportedLanguages();

    return {
      items: res,
      pageInfo: {
        hasNextPage: false,
        nextCursor: null,
      },
    };
  },
  supported_locales: async (_, args, context) => {
    checkAuth(context);

    const res = LocaleHelper.getSupportedLocales();

    return {
      items: res,
      pageInfo: {
        hasNextPage: false,
        nextCursor: null,
      },
    };
  },
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
  stage: async (_, args, context) => {
    checkAuth(context);

    const { journeyId, stageId } = args;

    const gen = ProgressHelper.getGeneratingStage(journeyId, stageId);

    if (gen) {
      await gen.waitUntil("generated");
      return gen.flow.stage;
    }

    const res = await Stage.findById(stageId);

    if (!res) {
      throw new Error("Stage not found");
    }

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

    let res = await Material.findById(args.id);

    if (!res) {
      throw new Error("Material not found");
    }

    const gen =
      MaterialGenerationHelper.generatingMaterials[args.id.toHexString()];

    if (gen) {
      await gen.waitUntil("generated");
    } else if (res.genStatus === "CREATING" && !gen) {
      const journey = await Journey.findById(res.journey_ID);
      if (!journey) {
        throw new Error("Journey not found");
      }
      const stage = await Stage.findById(res.stage_ID);
      if (!stage) {
        throw new Error("Stage not found");
      }
      const flow = new MaterialFlowContext({
        journey: journey,
        user: context.user!,
        stage: stage,
      });

      const ctx = new MaterialGenerationContext({
        flow,
        requiredMaterial: res,
        reason: "re-generate-material",
      });

      MaterialGenerationHelper.gen(ctx);

      await ctx.waitUntil("generated");
      console.log("generated reached");

      res = await Material.findById(args.id);

      if (!res) {
        throw new Error("Material not found");
      }
    }

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

    const res = await GlobalDocumentationManager.findOrCreateDocumentation({
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
      COLLECTIONS.USER_DOCS,
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
  user_doc: async (_, args, context) => {
    checkAuth(context);

    const res = await UserDoc.findById(args.id);

    if (!res) {
      throw new Error("User doc not found");
    }

    return res;
  },
};

export const userMutations: GqlTypes.UserMutationResolvers = {
  create_journey: async (_, args, context) => {
    checkAuth(context);

    const res = await JourneyHelper.createJourney(context.user!, args.input);

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
  Stage: {
    stagePart: async (parent) => {
      return await paginate<WithGQLID<IStagePart>>(
        COLLECTIONS.STAGE_PARTS,
        {
          limit: 1000,
          sort: "createdAt:asc",
        },
        {
          additionalQuery: {
            hidden: false,
            stage_ID: parent._id,
          },
        }
      );
    },
  },

  MaterialCreation: {
    material: async (parent) => {
      return await Material.findById(new ObjectId(parent.id as string));
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
    stages: async (parent, args) => {
      return paginate<WithGQLID<IStage>>(COLLECTIONS.STAGES, args.pagination, {
        additionalQuery: {
          journey_ID: parent._id,
        },
      });
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
