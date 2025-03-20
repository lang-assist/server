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
  IStage,
  ISupportedLanguage,
  ISupportedFromLocale,
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
      from: string;
      name: string;
      avatar: UploadingHsl;
      modelSet: ObjectId;

      referenceText: string;

      // Şimdi 3 şey test edilecek.
      // 1. Alfabeyi okuyabiliyor mu? - Reference text'i seslendirerek veya kendi alfabesinde yazarak tekrar etmesi gerekiyor.
      // 2. Okuduğu cümleleri anlıyor mu? - Reference text'i çevirmesi veya anladığını açıklaması gerekiyor.
      // 3. Kendini tanıtabiliyor mu? - Introduction'ı okuyabiliyor mu?

      // 1
      recording: ObjectId | null; // recording preferred
      repating: string | null; // repeating

      // 2
      description: string | null; // description or translation

      // 3
      introduction: string | null;
    };
    export type CreateJourneyResponse = WithGQLID<IJourney>;

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
      stageId: ObjectId;
      partId: ObjectId;
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
      stageId: ObjectId;
      type: BrocaTypes.Material.MaterialType;
    };
  }

  export type UserQueryResolvers = {
    my_journeys: ResolverFn<any, any, Connection<WithGQLID<IJourney>>>;
    journey: ResolverFn<any, { id: ObjectId }, WithGQLID<IJourney> | null>;
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
    user_doc: ResolverFn<any, { id: ObjectId }, WithGQLID<IUserDoc>>;
    stage: ResolverFn<
      any,
      { journeyId: ObjectId; stageId: ObjectId },
      WithGQLID<IStage>
    >;
    supported_languages: ResolverFn<
      any,
      any,
      Connection<WithGQLID<ISupportedLanguage>>
    >;
    supported_locales: ResolverFn<
      any,
      any,
      Connection<WithGQLID<ISupportedFromLocale>>
    >;
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
    answer_material: ResolverFn<
      any,
      {
        input: User.AnswerMaterialInput;
      },
      {
        currentStage: WithGQLID<IStage> | null;
        newStage: WithGQLID<IStage> | null;
      }
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

  export type UserTypesResolvers = {};
}
