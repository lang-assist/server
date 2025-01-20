import { AdminRole, Meta } from "../models/_index";
import ApiError from "../utils/error";
import stringHash from "string-hash";

export class RoleHelper {
  static predefinedRoles = {
    org_admin: {
      name: "super-admin",
      params: {},
      permissions: ["/*"],
      description: "The admin of the platform",
    },
  };

  static async createPredefinedRole(args: {
    name: string;
    params: Record<string, any>;
    permissions: string[];
  }) {
    const role = await AdminRole.updateOne(
      {
        name: args.name,
      },
      {
        $set: {
          params: args.params,
          permissions: args.permissions,
        },
      },
      {
        upsert: true,
      }
    );

    if (!role) {
      throw ApiError.e500("failed_to_create_role");
    }

    return role;
  }

  static async checkAndCreatePredefinedRoles() {
    const predefinedRolesHash = stringHash(
      JSON.stringify(this.predefinedRoles)
    );

    const meta = await Meta.findOne({
      name: "predefined_roles_hash",
    });

    if (!meta || meta.value !== predefinedRolesHash) {
      await Meta.updateOne(
        {
          name: "predefined_roles_hash",
        },
        {
          $set: {
            value: predefinedRolesHash,
          },
        },
        {
          upsert: true,
        }
      );

      for (const role of Object.values(this.predefinedRoles)) {
        await this.createPredefinedRole(role);
      }
    }
  }
}
