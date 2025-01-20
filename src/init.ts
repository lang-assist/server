import { CacheHelper, DbHelper, Dbs, MongoClient } from "./helpers/db";

import express from "express";
import ApiError from "./utils/error";
import http from "http";
import { berberEnv } from "./utils/env";
import { apiErrorHandler } from "./middleware/api_error_handler";
import { log, Log } from "./helpers/log";
import cors from "cors";

export { berberEnv };

export async function initCache() {
  await CacheHelper.connect();
}

export async function initDatabase(resolve: boolean) {
  await DbHelper.connect({
    market: berberEnv.MONGO_URL,
  });

  DbHelper.setCacheHelper(CacheHelper.instance);

  if (resolve) await DbHelper.resolve();
  else DbHelper.restoreLocally();
}

export function mongoClient(db: Dbs): MongoClient {
  return DbHelper.clients[db];
}

export async function init(
  port: number,
  cb: (app: express.Application, server: http.Server) => void,
  resolve: boolean = false
): Promise<express.Application> {
  await initCache();
  await initDatabase(resolve);

  const app = express();
  app.use(express.json());
  app.use(cors());
  app.use(
    express.urlencoded({
      extended: true,
    })
  );

  if (berberEnv.ENV !== "local") {
    app.use((req, res, next) => {
      // @ts-ignore
      req.log = Log.log;

      next();
    });
  } else {
    app.use((req, res, next) => {
      // @ts-ignore
      req.log = Log.log;

      next();
    });
  }

  const subOffset = berberEnv.HOST_NAME.split(".").length;

  app.set("subdomain offset", subOffset);

  app.get("/hc", (_, res) => {
    res.send("OK");
  });

  // app.use(ss({
  //     name: "session",
  //     secret: berberEnv.COOKIE_KEY,
  //     resave: false,
  //     rolling: false,
  //     proxy: true,
  //     cookie: {
  //         secure: berberEnv.ENV !== "local",
  //         httpOnly: false,
  //         maxAge: 1000 * 60 * 60 * 2, // 1 day
  //         sameSite: "none"
  //     },
  //     saveUninitialized: false,
  //     store: redisStore
  // }))
  const server = http.createServer(app);

  app.set("port", port);

  server.listen(port);

  cb(app, server);

  // app.use((req, _, next) => {
  //   if (req.subdomains.length === 1) {
  //     next();
  //   } else {
  //     if (!req.path.endsWith("/graphql")) {
  //       next(ApiError.e404("not_found"));
  //     } else {
  //       next();
  //     }
  //   }
  // });

  app.use(apiErrorHandler());

  server.on("error", (error: any) => {
    if (error.syscall !== "listen") {
      throw error;
    }

    const bind = "Port " + port;

    if (error.code === "EACCES") {
      log.error({
        message: bind + " requires elevated privileges",
      });
      process.exit(1);
    } else if (error.code === "EADDRINUSE") {
      log.error({
        message: bind + " is already in use",
      });
      process.exit(1);
    } else {
      throw error;
    }
  });

  server.on("listening", () => {
    const addr = server.address();
    const bind =
      typeof addr === "string" ? "pipe " + addr : "port " + addr?.port;
    log.info({
      message: "Listening on " + bind,
    });
  });

  process.on("SIGTERM", () => {
    server.close(() => {
      log.info({
        message: "Process terminated",
      });
      process.exit(0);
    });
  });

  return app;
}
