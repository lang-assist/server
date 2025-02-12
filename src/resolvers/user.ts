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
  UserDoc,
  AiFeedback,
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
import crypto from "crypto";
import { TermManager } from "../helpers/term";
import { DocumentationManager } from "../helpers/documentation";

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

    console.log(args);
    const r = await paginate("materials", args.pagination, {
      additionalQuery: {
        path_ID: args.id,
      },
    });

    console.log(r);

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

    console.log(args.input);

    const res = await DocumentationManager.findOrCreateDocumentation({
      journey,
      title: args.input.title,
      searchTerm: args.input.searchTerm,
    });

    console.log(res);

    return {
      __typename: "UserDoc",
      ...res.doc,
    };
  },
  journey_docs: async (_, args, context) => {
    checkAuth(context);

    const docs = await UserDoc.find({
      journey_ID: args.journeyId,
      user_ID: context.user!._id,
    });

    return docs;
  },
  material_feedbacks: async (_, args, context) => {
    checkAuth(context);

    const materialId = args.materialId;

    const pathId = args.pathId;

    if (MaterialHelper.generatingMaterials[pathId]) {
      const gens = MaterialHelper.generatingMaterials[pathId];

      for (const gen of Object.values(gens)) {
        if (gen.answeredMaterial === materialId) {
          await gen.promise;
        }
      }
    }

    return await AiFeedback.find({
      material_ID: materialId,
    });
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
      console.log(args.input);
      const res = await MaterialHelper.answerMaterial(args.input);
      console.log(res);
      return res;
    } catch (e) {
      console.error(e);
      throw ApiError.e500("Failed to answer material");
    }
  },
  regenerate_material: async (_, args, context) => {
    checkAuth(context);

    const res = await MaterialHelper.regenerateMaterial(args.materialId);

    return res;
  },
  prepare_material: async (_, args, context) => {
    checkAuth(context);

    const material = await Material.findById(args.materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    const journey = await Journey.findById(material.journey_ID);
    if (!journey) {
      throw new Error("Journey not found");
    }

    const res = await MaterialHelper.prepareMaterial({
      materialId: args.materialId,
      language: journey.to,
    });

    return res;
  },

  gen_material: async (_, args, context) => {
    checkAuth(context);

    const { journeyId, pathId, type } = args.input;

    const journey = await Journey.findById(journeyId);
    if (!journey) {
      throw new Error("Journey not found");
    }

    const path = await UserPath.findById(pathId);
    if (!path) {
      throw new Error("Path not found");
    }

    const res = await MaterialHelper.testGenMaterial({
      journey: journey,
      userPath: path,
      requiredMaterials: [{ type: type }],
    });

    return res;
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
      if (!obj) return null;
      const resolvedType = typesMapping[obj.type];

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
  Journey: {
    paths: async (parent) => {
      return await UserPath.find({
        journey_ID: parent._id,
        isActive: true,
      });
    },
  },
};
