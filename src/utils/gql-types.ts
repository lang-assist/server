import { ObjectId } from "mongodb";
import { AppContext } from "./types";
import {
  IJourney,
  IMaterial,
  IUserDoc,
  IConversationTurn,
  ITerms,
  IAiFeedback,
  IModelsSet,
} from "../models/_index";
import { WithGQLID } from "../helpers/db";
import { BrocaTypes } from "../types";

export namespace GqlTypes {
  export type UploadingHsl = {
    hsl: string;
  };
  export type JSON = any;

  export type ResolverFn<Parent = any, Args = any, Res = any> = (
    parent: Parent,
    args: Args,
    context: AppContext,
    info: any
  ) => Promise<Res>;

  export type Connection<T> = {
    items: WithGQLID<T>[];
    pageInfo: PageInfo;
  };

  export type PageInfo = {
    hasNextPage: boolean;
    nextCursor: string | null;
  };

  export type PaginationInput = {
    cursor?: string;
    filter?: {
      [key: string]: any;
    };
    sort?: string;
    limit?: number;
  };

  export namespace User {
    export type CreateJourneyInput = {
      to: string;
      name: string;
      avatar: UploadingHsl;
      modelSet: ObjectId;
    };
    export type CreateJourneyResponse = {
      journey: WithGQLID<IJourney>;
      materials: WithGQLID<IMaterial>[];
    };

    export type UpdateJourneyInput = {
      name?: string;
      avatar?: string;
    };

    export type DocumentationInput = {
      journeyId: ObjectId;
      title: string;
      searchTerm: string;
    };

    export type CreateMaterialInput = {
      journeyId: ObjectId;
      pathId: ObjectId;
    };

    export type AnswerMaterialInput = {
      materialId: ObjectId;
      answer: JSON;
    };

    export type CreatePathInput = {
      journeyId: ObjectId;
      type: BrocaTypes.Progress.PathType;
      profession?: string;
    };

    export type StartConversationInput = {
      materialId: ObjectId;
    };

    export type AddUserInputInput = {
      materialId: ObjectId;
      text?: string;
      audio_ID?: ObjectId;
    };

    export type GenMaterialInput = {
      journeyId: ObjectId;
      pathId: ObjectId;
      type: BrocaTypes.Material.MaterialType;
    };

    export type AnswerMaterialResponseNext =
      | "CREATING_NEW"
      | "INITIAL_END"
      | "INITIAL_CONTINUE";

    export type AnswerMaterialResponse = {
      next: AnswerMaterialResponseNext;
      newPath: string | null;
      newMaterial: ObjectId | null;
    };

    export type CreatePathResponse = {
      journey: WithGQLID<IJourney>;
      path: BrocaTypes.Progress.Path;
      materials: WithGQLID<IMaterial>[];
    };
  }

  export type UserQueryResolvers = {
    my_journeys: ResolverFn<any, any, Connection<WithGQLID<IJourney>>>;
    journey: ResolverFn<any, { id: ObjectId }, WithGQLID<IJourney> | null>;
    path_materials: ResolverFn<
      any,
      {
        journeyId: ObjectId;
        pathID: string;
        pagination?: PaginationInput;
      },
      Connection<WithGQLID<IMaterial>>
    >;
    material: ResolverFn<any, { id: ObjectId }, WithGQLID<IMaterial> | null>;
    conversation_turns: ResolverFn<
      any,
      { materialId: ObjectId },
      WithGQLID<IConversationTurn>[]
    >;
    parsed_units: ResolverFn<
      any,
      { text: string; journeyId: ObjectId },
      BrocaTypes.LinguisticUnits.LinguisticUnitSet
    >;
    documentation: ResolverFn<
      any,
      { input: User.DocumentationInput },
      IUserDoc
    >;
    journey_docs: ResolverFn<
      any,
      { journeyId: ObjectId; pagination?: PaginationInput },
      Connection<WithGQLID<IUserDoc>>
    >;
    material_feedbacks: ResolverFn<
      any,
      { materialId: ObjectId },
      IAiFeedback[]
    >;
    model_sets: ResolverFn<any, any, Connection<WithGQLID<IModelsSet>>>;
  };

  export type UserMutationResolvers = {
    create_journey: ResolverFn<
      any,
      {
        input: User.CreateJourneyInput;
      },
      User.CreateJourneyResponse
    >;
    delete_journey: ResolverFn<any, { id: ObjectId }, boolean>;
    update_journey: ResolverFn<
      any,
      { id: ObjectId; input: User.UpdateJourneyInput },
      WithGQLID<IJourney>
    >;
    create_path: ResolverFn<any, User.CreatePathInput, User.CreatePathResponse>;
    answer_material: ResolverFn<
      any,
      {
        input: User.AnswerMaterialInput;
      },
      User.AnswerMaterialResponse
    >;
    add_user_input: ResolverFn<
      any,
      {
        input: User.AddUserInputInput;
      },
      WithGQLID<IConversationTurn>
    >;
    reset_journey: ResolverFn<any, { id: ObjectId }, boolean>;
    clear_conversation: ResolverFn<any, { materialId: ObjectId }, boolean>;
    // remove_conversation_assistant: ResolverFn<any, any, boolean>;
    prepare_material: ResolverFn<
      any,
      { materialId: ObjectId },
      WithGQLID<IMaterial>
    >;
    regenerate_material: ResolverFn<
      any,
      { materialId: ObjectId },
      WithGQLID<IMaterial>
    >;
    gen_material: ResolverFn<any, User.GenMaterialInput, WithGQLID<IMaterial>>;
  };
}
