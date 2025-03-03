import { resolverDirective } from "./directives/resolver";
import {
  connectionDirective,
  groupByDirective,
  groupedConnectionDirective,
  paginateDirective,
} from "./directives/connection";
import {
  domainDirective,
  referenceDirective,
  nodeDirective,
  fromCollectionDirective,
} from "./directives/from";
import { GraphQLError, GraphQLScalarType, GraphQLSchema } from "graphql";

import path from "path";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { ApolloServer } from "@apollo/server";
import fs from "fs";
import { expressMiddleware } from "@apollo/server/express4";
import { berberEnv, init } from "./init";
import { createHash } from "crypto";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { AppContext } from "./utils/types";
import { withAuthGQL } from "./middleware/with_auth";
import { StorageService } from "./helpers/storage";

function loadSchema(): string[] {
  const dir = path.join(__dirname, "../../../lib/gql/schema");

  const files = fs.readdirSync(dir).filter((file) => file.endsWith(".graphql"));

  return files
    .map((file) => path.join(dir, file))
    .map((file) => fs.readFileSync(file, "utf-8"));
}

const defaultResolvers = {
  JSON: new GraphQLScalarType({
    name: "JSON",
    description: "JSON custom scalar type",
    serialize(value: any) {
      return JSON.stringify(value);
    },
    parseValue(value: any) {
      return JSON.parse(value);
    },
  }),
  LinguisticUnit: new GraphQLScalarType({
    name: "LinguisticUnit",
    description: "LinguisticUnit custom scalar type",
    serialize(value: any) {
      return JSON.stringify(value);
    },
    parseValue(value: any) {
      return JSON.parse(value);
    },
  }),
  LinguisticUnitSet: new GraphQLScalarType({
    name: "LinguisticUnitSet",
    description: "LinguisticUnitSet custom scalar type",
    async serialize(value: any) {
      if (typeof value !== "string") {
        return JSON.stringify(value);
      }
      return TermManager.get(value);
    },
    parseValue(value: any) {
      return JSON.parse(value);
    },
  }),
  DateTime: new GraphQLScalarType({
    name: "DateTime",
    description: "Date custom scalar type",
    serialize(value: any) {
      // validate is milliseconds since epoch
      if (typeof value !== "number" || isNaN(value)) {
        throw new Error("Invalid DateTime");
      }
      return value;
    },
    parseValue(value: any) {
      if (typeof value !== "number" || isNaN(value)) {
        throw new Error("Invalid DateTime");
      }
      return value;
    },
  }),
  Any: new GraphQLScalarType({
    name: "Any",
    description: "Any custom scalar type",
    serialize(value: any) {
      return value;
    },
    parseValue(value: any) {
      return value;
    },
  }),
  ID: new GraphQLScalarType({
    name: "ID",
    description: "ID custom scalar type",
    serialize(value: any) {
      return value.toString();
    },
    parseValue(value: any) {
      if (typeof value === "string" && ObjectId.isValid(value)) {
        return new ObjectId(value);
      }

      throw new Error("Invalid ID");
    },
  }),
  Contact: new GraphQLScalarType({
    name: "Contact",
    description: "Contact custom scalar type",
    serialize(value: any) {
      if (!validatePhoneNumber(value) && !validateEmail(value)) {
        throw new Error("Invalid Contact");
      }
      return value.toString();
    },
    parseValue(value: any) {
      if (!validatePhoneNumber(value) && !validateEmail(value)) {
        throw new Error("Invalid Contact");
      }
      return value.toString();
    },
  }),
  Email: new GraphQLScalarType({
    name: "Email",
    description: "Email custom scalar type",
    serialize(value: any) {
      if (!validateEmail(value)) {
        throw new Error("Invalid Email");
      }
      return value.toString();
    },
    parseValue(value: any) {
      if (!validateEmail(value)) {
        throw new Error("Invalid Email");
      }
      return value.toString();
    },
  }),
  PhoneNumber: new GraphQLScalarType({
    name: "PhoneNumber",
    description: "PhoneNumber custom scalar type",
    serialize(value: any) {
      if (!validatePhoneNumber(value)) {
        throw new Error("Invalid PhoneNumber");
      }
      return value.toString();
    },
    parseValue(value: any) {
      if (!validatePhoneNumber(value)) {
        throw new Error("Invalid PhoneNumber");
      }
      return value.toString();
    },
  }),
  VerifyCode: new GraphQLScalarType({
    name: "VerifyCode",
    description: "VerifyCode custom scalar type",
    serialize(value: any) {
      if (typeof value !== "string" || value.length !== 6) {
        throw new Error("Invalid VerifyCode");
      }
      return value.toString();
    },
    parseValue(value: any) {
      if (typeof value !== "string" || value.length !== 6) {
        throw new Error("Invalid VerifyCode");
      }
      return value.toString();
    },
  }),

  // Base64Data : Buffer
  Base64Data: new GraphQLScalarType({
    name: "Base64Data",
    description: "Base64Data custom scalar type",
    // @ts-ignore
    serialize(value: Binary) {
      return value.toString("base64");
    },
    parseValue(value: any) {
      return Buffer.from(value, "base64");
    },
  }),

  Avatar: new GraphQLScalarType({
    name: "Avatar",
    description: "Avatar custom scalar type",
    serialize(value: any) {
      if (validateColor(value) || ObjectId.isValid(value)) {
        return value.toString();
      }
      throw new Error("Invalid Avatar");
    },
    parseValue(value: any) {
      if (validateColor(value) || ObjectId.isValid(value)) {
        return value.toString();
      }
      throw new Error("Invalid Avatar");
    },
  }),

  Hsl: new GraphQLScalarType({
    name: "Hsl",
    description: "Hsl custom scalar type",
    serialize(value: any) {
      return value.toString();
    },
  }),
};

function setDirectives(schema: GraphQLSchema): GraphQLSchema {
  schema = resolverDirective(schema);
  schema = referenceDirective(schema);
  schema = connectionDirective(schema);
  schema = groupedConnectionDirective(schema);
  schema = paginateDirective(schema);
  schema = groupByDirective(schema);
  schema = nodeDirective(schema);
  schema = domainDirective(schema);
  schema = fromCollectionDirective(schema);
  return schema;
}

import rl from "node:readline";
import { authMutations, authQueries } from "./resolvers/auth";
import { publicMutations, publicQueries } from "./resolvers/public";
import { Binary, ObjectId } from "mongodb";
import {
  validateColor,
  validateEmail,
  validatePhoneNumber,
} from "./utils/validators";
import { adminMutations, adminQueries } from "./resolvers/admin";
import {
  userMutations,
  userQueries,
  userResolvers,
  userSubscriptions,
} from "./resolvers/user";
import { RoleHelper } from "./helpers/role";
import { TermManager } from "./helpers/gen/term";
function listen() {
  if (berberEnv.ENV !== "local") {
    return;
  }

  const i = rl.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  i.on("line", (line) => {
    if (line === "kill") {
      process.exit(0);
    }
  });
}

listen();

const resolvers = {
  ...defaultResolvers,

  AdminQuery: adminQueries,
  UserQuery: userQueries,
  PublicQuery: publicQueries,
  AuthQuery: authQueries,

  AdminMutation: adminMutations,
  UserMutation: userMutations,
  PublicMutation: publicMutations,
  AuthMutation: authMutations,

  Subscription: {
    ...userSubscriptions,
  },

  ...userResolvers,

  Query: {
    user: () => ({
      __typename: "UserQuery",
      // ...userQueries
    }),
    public: () => ({
      __typename: "PublicQuery",
      // ...publicQueries
    }),
    auth: () => ({
      __typename: "AuthQuery",
      // ...authQueries
    }),
    admin: () => ({
      __typename: "AdminQuery",
      // ...adminQueries
    }),
  },
  Mutation: {
    user: () => ({
      __typename: "UserMutation",
      // ...userMutations
    }),
    public: () => ({
      __typename: "PublicMutation",
      // ...publicMutations
    }),
    auth: () => ({
      __typename: "AuthMutation",
      // ...authMutations
    }),
    admin: () => ({
      __typename: "AdminMutation",
      // ...adminMutations
    }),
  },
};

init(
  berberEnv.SERVER_PORT,
  async (app, httpServer) => {
    try {
      const schema = makeExecutableSchema({
        typeDefs: loadSchema(),
        resolvers,
      });

      // Creating the WebSocket server
      const wsServer = new WebSocketServer({
        // This is the `httpServer` we created in a previous step.
        server: httpServer,
        // // Pass a different path here if app.use
        // // serves expressMiddleware at a different path
        path: "/graphql",

        handleProtocols(protocols, request) {
          return "graphql-ws";
        },
      });

      // WebSocket context ve error handling ekleyelim
      const serverCleanup = useServer(
        {
          schema,
          context: async (ctx): Promise<AppContext> => {
            // WebSocket connection context'i

            const nCtx = await withAuthGQL("user")({
              req: {
                // @ts-ignore
                headers: {
                  ...ctx.extra.request.headers,
                  ...ctx.connectionParams,
                },
                ip: ctx.extra.request.socket.remoteAddress,
              },
              res: undefined,
            });

            return {
              ...nCtx,
            };
          },
          onConnect: async (ctx) => {
            return true;
          },
          onDisconnect: async (ctx) => {},
          onError: (ctx, message, errors) => {},
          onOperation(ctx, message, args, result) {},
          onComplete(a) {},
          onClose(ctx, code, reason) {},
        },
        wsServer
      );
      const server = new ApolloServer({
        schema: setDirectives(schema),
        introspection: true,
        formatError: (error) => {
          console.error("ERROR", error);
          return {
            message: error.message,
            locations: error.locations,
            path: error.path,
            extensions: {
              payload: error.extensions?.payload,
              code: error.extensions?.code,
            },
          };
        },
        plugins: [
          // Proper shutdown for the HTTP server.
          ApolloServerPluginDrainHttpServer({ httpServer }),

          // Proper shutdown for the WebSocket server.
          {
            async serverWillStart(srv) {
              return {
                async drainServer() {
                  await serverCleanup.dispose();
                },
              };
            },
          },
        ],
      });

      await server.start();

      const middleware = expressMiddleware(server, {
        context: async ({ req, res }) => {
          return {
            req,
            res,
          };
        },
      }) as any;

      app.use("/storage", StorageService.hostMiddleware());
      app.use("/graphql", middleware);
    } catch (e) {
      if (e instanceof GraphQLError) {
        console.error(
          e.message,
          e.cause,
          e.locations,
          e.nodes,
          e.positions,
          e.path,
          e.source
        );
      } else {
        console.error(e);
      }
    }
  },
  true
).then(async () => {
  await RoleHelper.checkAndCreatePredefinedRoles();

  // await AIEmbeddingGenerator.deleteVoiceEmbeddings();
  // await AIEmbeddingGenerator.deleteIndex();
  // await AIEmbeddingGenerator.generateEmbeddingsForVoices();
  // await AIEmbeddingGenerator.cacheVoiceEmbeddings();
});
