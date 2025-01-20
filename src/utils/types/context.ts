import bunyan from "bunyan";
import { BaseContext } from "@apollo/server";
import { Response } from "express";
import { IResolvers } from "@graphql-tools/utils";
import ApiError from "../error";
import { IAuth } from "../../models/_index";
import { IAdmin } from "../../models/_index";
import { IToken } from "../../models/_index";
import { IUser } from "../../models/_index";
import { PermissionManager } from "../permission";
import { WithId } from "mongodb";
import { IDevice } from "../../models/_index";

export type AppResolvers<
  S extends any = any,
  A extends any = any,
  R extends any = any
> = IResolvers<S, AppContext, A, R>;

export function checkAuth(context: AppContext) {
  if (!context.user_permission || !context.user) {
    throw ApiError.e401("Unauthorized", "User is not authenticated");
  }
}

export function applyContext(to: AppContext, from: AppContext) {
  to.auth_checked = from.auth_checked;
  to.admin_permission = from.admin_permission;
  to.user_permission = from.user_permission;
  to.device = from.device;
  to.user = from.user;
  to.auth = from.auth;
  to.token = from.token;
  to.admin = from.admin;
}

export interface AppContext extends BaseContext {
  req: {
    headers?: NodeJS.Dict<string | string[]>;
    query?: NodeJS.Dict<string | string[]>;
    ip?: string;
  };
  res?: Response;
  admin_permission?: PermissionManager;
  user_permission?: PermissionManager;
  device?: WithId<IDevice>;
  user?: WithId<IUser>;
  auth?: WithId<IAuth>;
  token?: WithId<IToken>;
  admin?: WithId<IAdmin>;
  auth_checked?: boolean;
}

// declare module 'express-session' {
//     interface SessionData {
//         user?: WithId<IUser>;
//         call?: number;
//         token?: WithId<IToken>;
//         auth?: WithId<IAuth>;
//         device?: WithId<IDevice> | null;
//         admin?: WithId<IAdmin> | null;
//     }
// }
declare global {
  namespace Express {
    interface Request {
      log: bunyan;
    }
  }
}
