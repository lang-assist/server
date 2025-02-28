import { VectorDbs, VectorIndex } from "../helpers/vectors/indexes";

export const FOLDERS: {
  PROFILE: "profile";
  ASSET: "asset";
  ITEM_PICTURES: "item_pictures";
  AUDIO: "audio";
} = {
  PROFILE: "profile",
  ASSET: "asset",
  ITEM_PICTURES: "item_pictures",
  AUDIO: "audio",
};

export type FOLDER_TYPE = "profile" | "asset" | "item_pictures" | "audio";

// Collection names for database models
export const COLLECTIONS = {
  USERS: "users",
  ADMINS: "admins",
  ADMIN_ROLES: "admin_roles",
  AUTHS: "auth",
  AI_ERRORS: "ai_errors",
  AI_FEEDBACKS: "ai_feedback",
  CHATGPT_EVENTS: "chatgpt_events",
  CONVERSATION_TURNS: "conversation_turns",
  DEVICES: "devices",
  DICT_SEARCHES: "dict_searches",
  DICT_TEMPLATES: "dict_templates",
  DOC_SEARCHES: "doc_searches",
  DOC_TEMPLATES: "doc_templates",
  GEN_CTXES: "gen_ctxs",
  GENERATION_ENTRIES: "generation_entries",
  INITIAL_TEMPLATES: "initial_templates",
  JOURNEYS: "journeys",
  MATERIALS: "materials",
  METAS: "meta",
  MODELS_SETS: "models_sets",
  PROMPTS: "prompts",
  STORED_FILES: "stored_files",
  TERMS: "terms",
  TOKENS: "tokens",
  USAGES: "usages",
  USER_ANSWERS: "user_answers",
  USER_DICTS: "user_dicts",
  USER_DOCS: "user_docs",
  VERIFICATIONS: "verifications",
  VOICES: "voices",
} as const;

export type COLLECTION_TYPE = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export const PREDEFINED_ROLES = {
  OWNER: {
    id: "role_owner",
    name: "Owner",
    description: "Organizasyon sahibi",
    permissions: [
      "/org/settings/*",
      "/org/members/*",
      "/org/finance/*",
      "/org/reports/*",
      "/org/delete",
    ],
    predefined: true,
  },
  MANAGER: {
    id: "role_manager",
    name: "Manager",
    description: "Organizasyon yöneticisi",
    permissions: [
      "/org/members/list",
      "/org/members/invite",
      "/org/members/update",
      "/org/members/remove",
      "/org/finance/view",
      "/org/finance/manage",
      "/org/reports/view",
      "/org/settings/view",
    ],
    predefined: true,
  },
  STAFF: {
    id: "role_staff",
    name: "Staff",
    description: "Organizasyon personeli",
    permissions: [
      "/org/appointments/own/*",
      "/org/customers/own/*",
      "/org/reports/own/*",
    ],
    predefined: true,
  },
  RECEPTIONIST: {
    id: "role_receptionist",
    name: "Receptionist",
    description: "Resepsiyon görevlisi",
    permissions: [
      "/org/appointments/*",
      "/org/customers/*",
      "/org/reports/basic/*",
    ],
    predefined: true,
  },
  ACCOUNTANT: {
    id: "role_accountant",
    name: "Accountant",
    description: "Muhasebeci",
    permissions: [
      "/org/finance/view",
      "/org/finance/manage",
      "/org/reports/finance/*",
    ],
    predefined: true,
  },
} as const;

export type PredefinedRoleType = keyof typeof PREDEFINED_ROLES;

export const PERMISSIONS = {
  // Organizasyon ayarları
  ORG_SETTINGS_VIEW: "/org/settings/view",
  ORG_SETTINGS_MANAGE: "/org/settings/manage",
  ORG_DELETE: "/org/delete",

  // Üye yönetimi
  MEMBERS_LIST: "/org/members/list",
  MEMBERS_INVITE: "/org/members/invite",
  MEMBERS_UPDATE: "/org/members/update",
  MEMBERS_REMOVE: "/org/members/remove",

  // Finans yönetimi
  FINANCE_VIEW: "/org/finance/view",
  FINANCE_MANAGE: "/org/finance/manage",

  // Randevu yönetimi
  APPOINTMENTS_VIEW_OWN: "/org/appointments/own/view",
  APPOINTMENTS_MANAGE_OWN: "/org/appointments/own/manage",
  APPOINTMENTS_VIEW_ALL: "/org/appointments/view",
  APPOINTMENTS_MANAGE_ALL: "/org/appointments/manage",

  // Müşteri yönetimi
  CUSTOMERS_VIEW_OWN: "/org/customers/own/view",
  CUSTOMERS_MANAGE_OWN: "/org/customers/own/manage",
  CUSTOMERS_VIEW_ALL: "/org/customers/view",
  CUSTOMERS_MANAGE_ALL: "/org/customers/manage",

  // Raporlar
  REPORTS_VIEW_OWN: "/org/reports/own/view",
  REPORTS_VIEW_BASIC: "/org/reports/basic/view",
  REPORTS_VIEW_FINANCE: "/org/reports/finance/view",
  REPORTS_VIEW_ALL: "/org/reports/view",
} as const;

export const VECTOR_STORE_DIMS: {
  [key in VectorIndex]: number;
} = {
  voice_embeddings: 1536,
  doc_embeddings: 1536,
  dict_embeddings: 1536,
} as const;

export const VECTOR_STORE_EMBEDDERS: {
  [key in VectorIndex]: keyof typeof AIModels.embedding;
} = {
  voice_embeddings: "text_embedding_3_large_azure",
  doc_embeddings: "text_embedding_3_large_azure",
  dict_embeddings: "text_embedding_3_large_azure",
} as const;

export const VECTOR_STORE_DBS: {
  [key in VectorIndex]: VectorDbs;
} = {
  voice_embeddings: "redis",
  doc_embeddings: "redis",
  dict_embeddings: "redis",
} as const;

export const AIModels = {
  chat: {
    gpt_4o_assistant: "gpt_4o_assistant",
    gpt_4o_mini_assistant: "gpt_4o_mini_assistant",
    gpt_4o: "gpt_4o",
    o1: "o1",
    o1_mini: "o1_mini",
    claude_sonnet: "claude_sonnet",
    claude_sonnet37: "claude_sonnet37",
    deepseek_chat: "deepseek_chat",
    deepseek_r1: "deepseek_r1",
    azure_gpt_4o: "azure_gpt_4o",
    azure_gpt_4o_assistant: "azure_gpt_4o_assistant",
    azure_o1: "azure_o1",
    azure_o1_mini: "azure_o1_mini",
  },
  embedding: {
    text_embedding_3_small: "text_embedding_3_small",
    text_embedding_3_small_azure: "text_embedding_3_small_azure",
    text_embedding_3_large: "text_embedding_3_large",
    text_embedding_3_large_azure: "text_embedding_3_large_azure",
  },
  img: {
    fal_flux_schnell: "fal_flux_schnell",
    fal_sana: "fal_sana",
  },
  tts: {
    azure_tts: "azure_tts",
  },
  stt: {
    azure_stt: "azure_stt",
  },
} as const;

export async function settlePromises<T>(
  promises: Promise<T>[]
): Promise<(T | Error)[]> {
  return Promise.all(
    promises.map((p) =>
      p.catch((error) =>
        error instanceof Error ? error : new Error(String(error))
      )
    )
  );
}
