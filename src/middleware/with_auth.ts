import { RequestHandler, Response, NextFunction, Request } from "express";
import ApiError from "../utils/error";

import { ObjectId, WithId } from "mongodb";
import { verifyToken } from "../helpers/access";
import {
  IUser,
  IToken,
  IAuth,
  Admin,
  Device,
  AdminRole,
} from "../models/_index";
import { DeviceManager } from "../helpers/device";
import { AppContext } from "../utils/types";
import { PermissionManager } from "../utils/permission";

function merge(options?: {
  allowApiKey?: boolean;
  allowOrgId?: boolean;
  allowUser?: boolean;
  retrieveOrg?: boolean;
  allowOauthClient?: boolean;
  allowUnauthenticated?: boolean;
}) {
  return {
    allowUnauthenticated:
      options?.allowUnauthenticated === undefined
        ? false
        : options.allowUnauthenticated,
  };
}

// export function withAuth<
//   P = any,
//   ResBody = any,
//   ReqBody = any,
//   ReqQuery = any,
//   Locals extends Record<string, any> = Record<string, any>
// >(
//   allowUnauthenticated?: boolean,
//   allowBlocked?: boolean
// ): RequestHandler<P, ResBody, ReqBody, ReqQuery & { token?: string }, Locals> {
//   return async (
//     req: Request<P, ResBody, ReqBody, ReqQuery & { token?: string }, Locals>,
//     _: Response<ResBody, Locals>,
//     next: NextFunction
//   ) => {
//     try {
//       // @ts-ignore
//       if (req.session && req.session.user) {
//         if (req.session.device && !req.session.device.user) {
//           await DeviceManager.setAuth(
//             req,
//             req.session.auth!,
//             req.session.user!
//           );
//         }
//         return next();
//       }

//       const authHeader = req.headers["authorization"];

//       let credentials: string | null = null;

//       if (authHeader) {
//         const parts = authHeader.split(" ");

//         if (parts.length !== 2) {
//           return next(ApiError.e401("invalid_authorization_header"));
//         }

//         const scheme = parts[0];

//         if (!/^Bearer$/i.test(scheme)) {
//           return next(ApiError.e401("invalid_authorization_header"));
//         }

//         credentials = parts[1];
//       } else {
//         if (req.query && req.query?.token) {
//           credentials = req.query.token as string;
//         }
//       }

//       let tokenData: WithId<IToken> | null = null;
//       let userData: WithId<IUser> | null = null;
//       let auth: WithId<IAuth> | null = null;

//       if (!credentials) {
//         if (allowUnauthenticated) {
//           return next();
//         }

//         return next(ApiError.e401("no_auth_header"));
//       }

//       const tokenRes = await verifyToken(credentials);

//       if (!tokenRes) {
//         return next(ApiError.e401("invalid_token"));
//       }

//       tokenData = tokenRes.tokenData;
//       userData = tokenRes.user;
//       auth = tokenRes.auth;

//       req.session.user = userData;
//       req.session.auth = auth;
//       req.session.token = tokenData;
//       req.session.save();
//       await DeviceManager.setAuth(req, auth, userData);

//       if (userData.status === "deleted") {
//         return next(ApiError.e401("user_deleted"));
//       }

//       if (allowBlocked) {
//         return next();
//       }

//       if (userData.status === "blocked") {
//         return next(ApiError.e401("user_blocked"));
//       }

//       next();
//     } catch (e) {
//       next(e);
//     }
//   };
// }

export function withAuthGQL(domain: "admin" | "user" | "public" | "auth") {
  return async ({ req, res }: AppContext): Promise<AppContext> => {
    try {
      let context: AppContext = {
        req,
        res,
        auth_checked: true,
      };

      const deviceHeader =
        (req.headers?.["x-device-id"] as string | undefined) ||
        (req.query?.deviceId as string | undefined);

      if (deviceHeader && ObjectId.isValid(deviceHeader)) {
        const device = await Device.findById(new ObjectId(deviceHeader));
        if (device) {
          context.device = device;

          DeviceManager.setUpdatedAt(context);
        }
      }

      const authHeader =
        (req.headers?.["authorization"] as string | undefined) ||
        (req.headers?.["Authorization"] as string | undefined) ||
        (req.query?.token as string | undefined);

      let credentials: string | null = null;

      if (authHeader) {
        const parts = authHeader.split(" ");

        if (parts.length !== 2) {
          throw ApiError.e401("invalid_authorization_header");
        }

        const scheme = parts[0];

        if (!/^Bearer$/i.test(scheme)) {
          throw ApiError.e401("invalid_authorization_header");
        }

        credentials = parts[1];
      } else {
        if (req.query && req.query?.token) {
          credentials = req.query.token as string;
        }
      }

      let tokenData: WithId<IToken> | null = null;
      let userData: WithId<IUser> | null = null;
      let auth: WithId<IAuth> | null = null;

      if (!credentials) {
        return context;
      }

      const tokenRes = await verifyToken(credentials);
      if (!tokenRes) {
        throw ApiError.e401("invalid_token");
      }

      if (!tokenRes) {
        return context;
      }

      tokenData = tokenRes.tokenData;

      userData = tokenRes.user;
      auth = tokenRes.auth;

      context.user = userData;
      context.auth = auth;
      context.token = tokenData;

      context.user_permission = new PermissionManager(
        [`/client/${userData._id}`],
        {}
      );

      if (context.device && !context.device.user) {
        await DeviceManager.setAuth(context);
      }

      switch (domain) {
        case "admin":
          const admin = await Admin.findOne({
            user: userData._id,
          });
          if (!admin) {
            throw ApiError.e401("admin_not_found");
          }

          const role1 = await AdminRole.findById(admin.role);
          if (!role1) {
            throw ApiError.e401("role_not_found");
          }

          context.admin_permission = new PermissionManager(
            role1.permissions,
            admin.roleParams || {}
          );
          context.admin = admin;
          break;

        case "user":
          break;
        case "public":
          break;
        case "auth":
          break;
      }

      if (userData.status === "deleted") {
        throw ApiError.e401("user_deleted");
      }

      if (userData.status === "blocked") {
        throw ApiError.e401("user_deleted");
      }

      if (userData.status === "frozen") {
        throw ApiError.e401("user_blocked");
      }

      return context;
    } catch (e) {
      return {
        req,
        res,
        auth_checked: true,
      };
    }
  };
}
