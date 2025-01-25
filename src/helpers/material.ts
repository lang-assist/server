import { ObjectId, WithId } from "mongodb";
import {
  ConversationTurn,
  IJourney,
  IMaterial,
  InitialTemplate,
  IUser,
  IUserAnswer,
  IUserPath,
  Material,
  User,
  UserAnswer,
  UserPath,
} from "../models/_index";
import { Journey } from "../models/_index";
import { AIModel } from "./ai";
import { randomColor } from "../utils/random";
import {
  MaterialDetails,
  MaterialMetadata,
  MaterialType,
  ConversationDetails,
  QuizDetails,
  PromptTags,
  SupportedLocale,
} from "../utils/types";
import { initialMaterialGenerationPrompt, instructions } from "./prompts";
import { PictureHelper } from "./picture";
import { ConversationManager } from "./conversation";
import { msg, PromptBuilder } from "ai-prompter";
import { materialGenInstructions } from "./prompts";

function modifyMaterials(material: {
  details: MaterialDetails;
  metadata: MaterialMetadata;
}): {
  metadata: MaterialMetadata;
  details: MaterialDetails;
} {
  material.metadata.avatar = randomColor();

  switch (material.details.type) {
    case "CONVERSATION":
      const characters = (material.details as ConversationDetails).characters;

      const newCharacters = characters.map((c) => {
        if (c.name === "$user") {
          return c;
        }

        const id = new ObjectId();

        PictureHelper.generateItemPicture({
          itemId: id,
          prompt: c.avatarPrompt,
        }).catch(() => {
          return id.toHexString();
        });

        return {
          ...c,
          avatar: id.toHexString(),
        };
      });

      (material.details as ConversationDetails).characters = newCharacters;

      break;

    case "QUIZ":
      const questions = (material.details as QuizDetails).questions;

      const newQuestions = questions.map((q) => {
        const items = q.items?.map((i) => {
          if (!i.picturePrompt) {
            return i;
          }

          const id = new ObjectId();
          PictureHelper.generateItemPicture({
            itemId: id,
            prompt: i.picturePrompt,
          }).catch(() => {
            return id.toHexString();
          });

          return {
            ...i,
            pictureId: id.toHexString(),
          };
        });

        const choices = q.choices?.map((c) => {
          if (!c.picturePrompt) {
            return c;
          }

          const id = new ObjectId();
          PictureHelper.generateItemPicture({
            itemId: id,
            prompt: c.picturePrompt,
          });

          return {
            ...c,
            pictureId: id.toHexString(),
          };
        });

        const secondItems = q.secondItems?.map((i) => {
          if (!i.picturePrompt) {
            return i;
          }

          const id = new ObjectId();
          PictureHelper.generateItemPicture({
            itemId: id,
            prompt: i.picturePrompt,
          }).catch(() => {
            return id.toHexString();
          });

          return {
            ...i,
            pictureId: id.toHexString(),
          };
        });

        return {
          ...q,
          items: items,
          choices: choices,
          secondItems: secondItems,
        };
      });

      (material.details as QuizDetails).questions = newQuestions;

      const preludes = (material.details as QuizDetails).preludes;

      if (preludes && preludes.length > 0) {
        const newPreludes = preludes.map((p) => {
          if (p.parts.length > 0) {
            for (const part of p.parts) {
              if (part.type === "PICTURE" && part.picturePrompt) {
                const id = new ObjectId();
                PictureHelper.generateItemPicture({
                  itemId: id,
                  prompt: part.picturePrompt!,
                }).catch(() => {
                  return id.toHexString();
                });

                part.pictureId = id.toHexString();
              }
            }
          }

          return p;
        });

        (material.details as QuizDetails).preludes = newPreludes;
      }

      break;
  }

  return {
    metadata: material.metadata,
    details: material.details,
  };
}

export class MaterialHelper {
  static generatingMaterials: {
    [path: string]: {
      [genId: string]: Promise<WithId<IMaterial>[]>;
    };
  } = {};

  static generateMaterial(
    builder: PromptBuilder,
    args: {
      journey: WithId<IJourney>;
      userPath: WithId<IUserPath>;
      answer?: WithId<IUserAnswer> | null;
      requiredMaterials: {
        type: MaterialType;
        optional?: boolean;
        description?: string;
      }[];
    }
  ) {
    const genId = new ObjectId().toHexString();
    const pathId = args.userPath._id.toHexString();

    if (!this.generatingMaterials[pathId]) {
      this.generatingMaterials[pathId] = {};
    }

    this.generatingMaterials[pathId][genId] = new Promise<WithId<IMaterial>[]>(
      async (resolve, reject) => {
        try {
          const user = await User.findById(args.userPath.user_ID);
          if (!user) {
            throw new Error("User not found");
          }

          const res = await AIModel.generateMaterial(builder, {
            aiModel: args.journey.aiModel,
            language: args.journey.to,
            userPath: args.userPath,
            journey: args.journey,
            answer: args.answer,
            requiredMaterials: args.requiredMaterials,
          });

          const materials: WithId<IMaterial>[] = [];
          for (const material of res) {
            const modified = modifyMaterials({
              ...material,
            });

            const inserted = await Material.insertOne({
              ...modified,
              journey_ID: args.journey._id,
              path_ID: args.userPath._id,
              status: "PENDING",
              user_ID: args.userPath.user_ID,
            });

            if (!inserted) {
              throw new Error("Material not inserted");
            }

            if (material.details.type === "CONVERSATION") {
              User.findById(args.userPath.user_ID)
                .then((user) => {
                  if (!user) {
                    throw new Error("User not found");
                  }

                  ConversationManager.prepareConversation(
                    inserted._id,
                    user
                  ).catch((err) => {
                    console.error("ERR", err);
                  });
                })
                .catch((err) => {
                  console.error("ERR", err);
                });
            }

            materials.push(inserted);
          }

          resolve(materials);
        } catch (e) {
          reject(e);
        }
      }
    );

    this.generatingMaterials[pathId][genId].finally(() => {
      delete this.generatingMaterials[pathId][genId];
      if (Object.keys(this.generatingMaterials[pathId]).length === 0) {
        delete this.generatingMaterials[pathId];
      }
    });

    return this.generatingMaterials[pathId][genId];
  }

  static generatingCount(pathId: string) {
    if (!this.generatingMaterials[pathId]) {
      return 0;
    }

    return Object.keys(this.generatingMaterials[pathId]).length;
  }

  static generatingPathMaterials(pathId: string) {
    return this.generatingMaterials[pathId] || [];
  }

  static async getPromptBuilder(args: {
    user: WithId<IUser>;
    journey: WithId<IJourney>;
    path: WithId<IUserPath>;
    answer?: WithId<IUserAnswer> | null;
  }) {
    const builder = new PromptBuilder({
      userName: args.user.name,
      language: args.journey.to,
    });

    await materialGenInstructions(builder, {
      journey: args.journey,
      userPath: args.path,
      answer: args.answer,
    });

    return builder;
  }

  static async getInitialMaterials(
    language: SupportedLocale,
    level: 1 | 2 | 3,
    aiModel: string
  ) {
    const template = await InitialTemplate.findOne({
      locale: language,
      level,
    });

    if (!template) {
      const existingTemplates = await InitialTemplate.find({
        locale: language,
        aiModel: aiModel,
        level: {
          $gt: level,
        },
      });

      const existingMaterials = existingTemplates.flatMap((t) =>
        t.materials.map((m) => ({
          level: t.level,
          details: m.details,
          metadata: m.metadata,
        }))
      );

      const builder = new PromptBuilder({
        userName: "unknown",
        language: language,
      });

      builder.systemMessage(instructions.main, {
        extra: {
          tags: [PromptTags.MAIN],
        },
      });

      initialMaterialGenerationPrompt(builder, existingMaterials, level);

      const generated = await AIModel.generateMaterial(builder, {
        aiModel: aiModel,
        language: language,
        requiredMaterials: [
          {
            type: "QUIZ",
            optional: false,
            description: "",
          },
          level === 3
            ? {
                type: "CONVERSATION",
                optional: false,
                description: "",
              }
            : null,
        ].filter((e) => e !== null) as {
          type: MaterialType;
          optional?: boolean;
          description?: string;
        }[],
      });

      const modified = generated.map((material) => {
        return modifyMaterials(material);
      });

      const inserted = await InitialTemplate.insertOne({
        locale: language,
        level,
        materials: modified,
        aiModel: aiModel,
      });

      if (!inserted) {
        throw new Error("Template not inserted");
      }

      return inserted.materials;
    }

    return template.materials;
  }

  static async createMaterialForInitial(input: {
    journeyId: ObjectId;
    pathId: ObjectId;
  }): Promise<WithId<IMaterial>[]> {
    const journey = await Journey.findById(input.journeyId);
    if (!journey) {
      throw new Error("Journey not found");
    }

    let path = await UserPath.findById(input.pathId);
    if (!path) {
      throw new Error("Path not found");
    }

    if (path.type !== "INITIAL") {
      throw new Error("Path is not initial");
    }

    if (!path.initialLevel) {
      path = await UserPath.findByIdAndUpdate(path._id, {
        $set: {
          initialLevel: 3,
        },
      });

      if (!path) {
        throw new Error("Path not found");
      }
    } else {
      if (path.initialLevel === 1) {
        throw new Error("Path initial level is 1");
      }

      path = await UserPath.findByIdAndUpdate(path._id, {
        $set: {
          initialLevel: (path.initialLevel - 1) as 3 | 2 | 1,
        },
      });

      if (!path) {
        throw new Error("Path not found");
      }
    }

    const initialLevel = path.initialLevel;

    let template = await this.getInitialMaterials(
      journey.to,
      initialLevel!,
      journey.aiModel
    );

    await Material.deleteMany({
      journey_ID: journey._id,
      path_ID: path._id,
    });

    const materials: WithId<IMaterial>[] = [];
    for (const material of template) {
      const inserted = await Material.insertOne({
        journey_ID: journey._id,
        path_ID: path._id,
        user_ID: path.user_ID,
        status: "PENDING",
        metadata: material.metadata,
        details: material.details,
        step: 0,
      });
      if (inserted) {
        materials.push(inserted);
        if (material.details.type === "CONVERSATION") {
          User.findById(path.user_ID)
            .then((user) => {
              if (!user) {
                throw new Error("User not found");
              }

              ConversationManager.prepareConversation(inserted._id, user).catch(
                (err) => {
                  console.error("ERR", err);
                }
              );
            })
            .catch((err) => {
              console.error("ERR", err);
            });
        }
      }
    }

    await UserPath.findByIdAndUpdate(path._id, {
      $set: {
        stage: "1",
      },
    });

    return materials;
  }

  static withIntend(text: string) {
    return text
      .split("\n")
      .map((t) => `  ${t}`)
      .join("\n");
  }

  static async preparePath(journey: WithId<IJourney>, path: WithId<IUserPath>) {
    const user = await User.findById(path.user_ID);
    if (!user) {
      throw new Error("User not found");
    }

    // Create a new 3 material for the path
    const builder = await this.getPromptBuilder({
      user: user,
      journey: journey,
      path: path,
    });

    builder.userMessage("Create a new 3 material for the path", {
      extra: {
        tags: [PromptTags.MATERIAL],
      },
    });

    const existingMaterials = await Material.find({
      path_ID: path._id,
    });

    if (existingMaterials.length > 3) {
      return;
    }

    let existingTypes: {
      type: MaterialType;
      optional?: boolean;
      description?: string;
    }[] = [
      {
        type: "QUIZ",
        optional: false,
        description: "General quiz material",
      },
      {
        type: "CONVERSATION",
        optional: false,
        description: "Create a new conversation material for the path",
      },
      {
        type: "QUIZ",
        optional: false,
        description:
          "Secondary quiz material. User will answer this quiz after the complete first quiz and conversation.",
      },
    ];

    for (const exists of existingMaterials) {
      existingTypes = existingTypes.filter(
        (t) => t.type !== exists.details.type
      );
    }

    await this.generateMaterial(builder, {
      journey: journey,
      userPath: path,
      requiredMaterials: existingTypes,
    });
  }

  static async answerMaterial(input: {
    materialId: ObjectId;
    answer: any;
  }): Promise<{
    answer: WithId<IUserAnswer>;
    next: "CREATING_NEW" | "INITIAL_END" | "INITIAL_CONTINUE";
    newPath: ObjectId | null;
  }> {
    const material = await Material.findById(input.materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    const path = await UserPath.findById(material.path_ID);
    if (!path) {
      throw new Error("Path not found");
    }

    const journey = await Journey.findById(path.journey_ID);
    if (!journey) {
      throw new Error("Journey not found");
    }

    let answer: any | undefined = undefined;

    if (material.details.type === "CONVERSATION") {
      if (material.status !== "COMPLETED") {
        throw new Error("Material is not completed");
      }

      const turns = await ConversationTurn.find({
        material_ID: material._id,
      });

      if (turns.length === 0) {
        throw new Error("Conversation has no turns");
      }

      const message = msg();

      message.addKv("Conversation", (msg) => {
        for (const turn of turns) {
          msg.addKv(`- ${turn.character}`, turn.text);
          if (turn.analyze) {
            msg.addKv("Analysis", (msg) => {
              for (const [key, value] of Object.entries(turn.analyze!)) {
                msg.addKv(`${key}`, value);
              }
            });
          }
        }
      });

      answer = message.build();
    } else if (material.status !== "PENDING") {
      throw new Error("Material is not pending");
    } else {
      answer = input.answer;
    }

    const createdAnswer = await UserAnswer.insertOne({
      material_ID: material._id,
      path_ID: path._id,
      user_ID: material.user_ID,
      answers: answer,
    });

    if (!createdAnswer) {
      throw new Error("Answer not inserted");
    }

    if (path.type === "INITIAL") {
      // Check all materials answered
      const unAnsweredMaterials = await Material.aggregate([
        {
          $match: {
            path_ID: path._id,
          },
        },
        {
          $lookup: {
            from: "user_answers",
            localField: "_id",
            foreignField: "material_ID",
            as: "answers",
          },
        },
        {
          $match: {
            $expr: {
              $eq: [
                {
                  $size: "$answers",
                },
                0,
              ],
            },
          },
        },
      ]);

      if (unAnsweredMaterials.length === 0) {
        const user = await User.findById(path.user_ID);
        if (!user) {
          throw new Error("User not found");
        }

        const builder = await this.getPromptBuilder({
          user: user,
          journey: journey,
          path: path,
          answer: createdAnswer,
        });

        builder.userMessage(
          "Only analyze the user's answers. don't create any new materials.",
          {
            extra: {
              tags: [PromptTags.MATERIAL],
            },
          }
        );

        await this.generateMaterial(builder, {
          journey: journey,
          userPath: path,
          answer: createdAnswer,
          requiredMaterials: [],
        });

        const existingPath = await UserPath.findById(path._id);
        if (!existingPath) {
          throw new Error("Path not found");
        }

        const created = await UserPath.insertOne({
          journey_ID: journey._id,
          user_ID: path.user_ID,
          type: "GENERAL",
          isActive: true,
          isMain: true,
          progress: existingPath.progress,
          name: "Daily",
          lastStudyDate: Date.now(),
          description: "Daily path",
        });

        if (!created) {
          throw new Error("Path not created");
        }

        // Deactivate old path
        await UserPath.findByIdAndUpdate(path._id, {
          $set: {
            isActive: false,
            isMain: false,
          },
        });

        await this.preparePath(journey, created);

        return {
          answer: createdAnswer,
          next: "INITIAL_END",
          newPath: created._id,
        };
      } else {
        const user = await User.findById(path.user_ID);
        if (!user) {
          throw new Error("User not found");
        }

        const builder = await this.getPromptBuilder({
          user: user,
          journey: journey,
          path: path,
          answer: createdAnswer,
        });

        builder.assistantMessage(
          "Only analyze the user's answers. don't create any new materials.",
          {
            extra: {
              tags: [PromptTags.MATERIAL],
            },
          }
        );

        await this.generateMaterial(builder, {
          journey: journey,
          userPath: path,
          answer: createdAnswer,
          requiredMaterials: [],
        });

        return {
          answer: createdAnswer,
          next: "INITIAL_CONTINUE",
          newPath: null,
        };
      }
    } else {
      const user = await User.findById(path.user_ID);
      if (!user) {
        throw new Error("User not found");
      }

      const builder = await this.getPromptBuilder({
        user: user,
        journey: journey,
        path: path,
        answer: createdAnswer,
      });

      this.generateMaterial(builder, {
        journey: journey,
        userPath: path,
        answer: createdAnswer,
        requiredMaterials: [
          {
            type: material.details.type,
            optional: false,
            description: "Generate a new material. Only generate one material.",
          },
        ],
      }).catch((err) => {
        console.error("ERR", err);
      });

      return {
        answer: createdAnswer,
        next: "CREATING_NEW",
        newPath: null,
      };
    }
  }
}
