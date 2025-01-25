import { MaterialHelper } from "../helpers/material";
import { JourneyHelper } from "../helpers/journey";
import { paginate } from "../helpers/pagination";
import {
  Journey,
  UserPath,
  Material,
  ConversationTurn,
  InitialTemplate,
  UserAnswer,
  AiFeedback,
  IMaterial,
} from "../models/_index";
import {
  MaterialDetails,
  typesMapping,
  AppResolvers,
  checkAuth,
} from "../utils/types";
import ApiError from "../utils/error";
import { DbHelper, ObjectId, WithId } from "../helpers/db";
import { AIModel } from "../helpers/ai/base";
import { ConversationManager } from "../helpers/conversation";

export const userQueries: AppResolvers = {
  my_journeys: async (_, args, context) => {
    checkAuth(context);

    const res = await paginate(
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

    return res;
  },
  material: async (_, args, context) => {
    checkAuth(context);

    const res = await Material.findById(args.id);

    return res;
  },
  path: async (_, args, context) => {
    checkAuth(context);

    const res = await UserPath.findById(args.id);

    return res;
  },
  initial_path: async (_, args, context) => {
    checkAuth(context);

    const journey = await Journey.findById(args.journeyId);

    if (!journey) {
      throw new Error("Journey not found");
    }

    const path = await UserPath.findOne({
      journey_ID: journey._id,
      type: "INITIAL",
      user_ID: context.user!._id,
    });

    if (!path) {
      throw new Error("Path not found");
    }

    const materials = await Material.find({
      path_ID: path._id,
    });

    return {
      path,
      materials,
    };
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

    const r = await paginate("materials", args.pagination, {
      additionalQuery: {
        path_ID: args.id,
      },
    });

    console.log(r.items.length, args.pagination.cursor);

    if (r.items.length < 3 && !args.pagination.cursor) {
      const path = await UserPath.findById(args.id);
      if (!path) {
        throw new Error("Path not found");
      }

      const newLength =
        r.items.length + MaterialHelper.generatingCount(path._id.toHexString());

      if (newLength > 3) {
        return r;
      }

      const journey = await Journey.findById(path.journey_ID);
      if (!journey) {
        throw new Error("Journey not found");
      }

      MaterialHelper.preparePath(journey, path).catch((e) => {
        console.error(e);
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const generatingMaterials = MaterialHelper.generatingPathMaterials(args.id);

    for (const material of Object.keys(generatingMaterials)) {
      const id = new ObjectId(material);
      r.items.push({
        _id: id,
        __typename: "CreatingMaterial",
        status: "PENDING",
      });
    }

    for (const material of r.items) {
      material.id = material._id.toHexString();
    }

    return r;
  },
};
export const userMutations: AppResolvers = {
  create_journey: async (_, args, context) => {
    checkAuth(context);

    const res = await JourneyHelper.createJourney(context.user!, args.input);

    return res;
  },
  answer_material: async (_, args, context) => {
    checkAuth(context);

    try {
      const res = await MaterialHelper.answerMaterial(args.input);

      return res;
    } catch (e) {
      console.error(e);
      throw ApiError.e500("Failed to answer material");
    }
  },
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

    const res = await ConversationManager.addUserInput(args.input);

    return res;
  },
  unUnderstoodQuestions: async (_, args, context) => {
    checkAuth(context);

    const { pathId, journeyId } = args;

    const path = await UserPath.findById(pathId);
    if (!path) {
      throw new Error("Path not found");
    }

    const materials = await MaterialHelper.createMaterialForInitial({
      journeyId,
      pathId,
    });

    if (!materials) {
      throw new Error("Failed to create initial material");
    }

    return {
      __typename: "StartInitialResponse",
      path,
      materials,
    };
  },
  delete_temp: async (_, args, context) => {
    checkAuth(context);

    await InitialTemplate.deleteMany({
      level: args.num,
    });

    return true;
  },
  reset_journey: async (_, args, context) => {
    checkAuth(context);

    await UserPath.deleteMany({
      journey_ID: args.id,
    });

    await Material.deleteMany({
      journey_ID: args.id,
    });

    await Journey.findByIdAndDelete(args.id);

    await DbHelper.cacheHelper!.deletePattern("ula:*");

    return true;
  },
  clear_conversation: async (_, args, context) => {
    checkAuth(context);

    await Material.findByIdAndUpdate(args.materialId, {
      $unset: {
        assistantId: "",
        instructions: "",
        threadId: "",
        // @ts-ignore
        preparing: "",
      },
    });

    await ConversationTurn.deleteMany({
      material_ID: args.materialId,
    });

    return true;
  },
  remove_conversation_assistant: async (_, args, context) => {
    checkAuth(context);

    // @ts-ignore
    AIModel.models["gpt-4o-mini"].removeAssistant();
    // @ts-ignore
    AIModel.models["gpt-4o"].removeAssistant();

    return true;
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
    __resolveType: (obj: MaterialDetails) => {
      const resolvedType = typesMapping[obj.type];

      return resolvedType;
    },
  },
  AnyMaterial: {
    __resolveType: (obj: any) => {
      if (obj.metadata) {
        return "Material";
      }

      return "CreatingMaterial";
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
  Material: {
    type: (parent) => {
      return parent.details.type;
    },
    answer: async (parent) => {
      return await UserAnswer.findOne({
        material_ID: parent._id,
      });
    },
  },
  Journey: {
    paths: async (parent) => {
      return await UserPath.find({
        journey_ID: parent._id,
        isActive: true,
      });
    },
  },
};
