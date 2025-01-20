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
