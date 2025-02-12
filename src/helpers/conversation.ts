import { ObjectId, WithId } from "mongodb";
import {
  ConversationTurn,
  IConversationTurn,
  IMaterial,
  IUser,
  Journey,
  Material,
  UserPath,
} from "../models/_index";
import { AIEmbeddingGenerator, AIModel } from "./ai/base";
import { ConversationDetails, PromptTags } from "../utils/types";
import { StorageService } from "./storage";
import { AzureVoice } from "./voice/azure";
import { AIConversationTurnResponse } from "../utils/ai-types";
import { AudioHelper } from "./audio";
import { msg, PromptBuilder } from "ai-prompter";
import {
  conversationCharactersInstructions,
  conversationGenInstructions,
} from "./prompts";

export class ConversationManager {
  private static _preparingConversations: {
    [key: string]: Promise<WithId<IMaterial>> | undefined;
  } = {};

  static async prepareConversation(
    materialId: ObjectId,
    user: WithId<IUser>
  ): Promise<WithId<IMaterial>> {
    const id = materialId.toHexString();

    if (this._preparingConversations[id]) {
      return this._preparingConversations[id];
    }

    const material = await Material.findById(materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    console.log("PREPARING Conversation", material);

    const promise = (async () => {
      let conversation: WithId<IMaterial> | null = material;

      const journey = await Journey.findById(conversation.journey_ID);

      if (!journey) {
        throw new Error("Journey not found");
      }

      const userPath = await UserPath.findById(conversation.path_ID);

      if (!userPath) {
        throw new Error("User path not found");
      }

      const characters = await AIEmbeddingGenerator.selectVoice(
        material.details as ConversationDetails
      );

      conversation = await Material.findByIdAndUpdate(materialId, {
        $set: {
          // @ts-ignore
          "details.voices": characters,
        },
      });

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      console.log("Conversation updated", conversation);

      const builder = new PromptBuilder({
        userName: user.name,
        language: journey.to,
      });

      const charactersMsg = await conversationCharactersInstructions({
        conversation: conversation,
      });

      conversationGenInstructions(builder, {
        charactersMsg,
        journey: journey,
        userPath: userPath,
        conversation: conversation,
      });

      const prepareRes = await AIModel.prepareConversation(
        builder,
        conversation,
        journey
      );

      conversation = prepareRes.material;

      let nextTurn: string | null = null;

      builder.assistantMessage("We don't generate turns for now", {
        extra: {
          tags: [PromptTags.TURNS],
        },
      });
      builder.userMessage("Generate first turn", {
        extra: {
          tags: [PromptTags.TURNS],
        },
      });

      do {
        const createRes = await AIModel.generateConversationTurn(
          builder,
          conversation,
          journey,
          nextTurn
        );

        nextTurn = (
          await this._createTurnForAI({
            materialId: conversation._id,
            res: createRes,
            language: journey.to,
          })
        ).nextTurn;
      } while (nextTurn !== null && nextTurn !== "$user");

      return conversation;
    })();

    promise.finally(() => {
      delete this._preparingConversations[id];
    });

    this._preparingConversations[id] = promise;

    return this._preparingConversations[id];
  }

  private static async _createTurnForAI(args: {
    materialId: ObjectId;
    res: AIConversationTurnResponse;
    language: string;
  }): Promise<{
    turn: WithId<IConversationTurn>;
    nextTurn: string | null;
  }> {
    const turn = args.res.turn;

    const nextTurn = args.res.nextTurn;

    const id = args.materialId.toHexString();

    if (!turn) {
      throw new Error("Unexpected error");
    }

    if (!turn.ssml) {
      throw new Error("Unexpected error");
    }

    const speak = new ObjectId();
    const turnId = new ObjectId();

    AudioHelper.generateAudio({
      audioId: speak,
      ssml: turn.ssml,
      turnId: turnId,
      language: args.language,
    }).catch((e) => {
      console.error("SPEAK ERROR", e);
    });

    const created = await ConversationTurn.insertOne(
      {
        material_ID: args.materialId,
        character: turn.character,
        text: turn.text,
        ssml: turn.ssml,
        audio_ID: speak,
        nextTurn: nextTurn,
      },
      turnId
    );

    if (!created) {
      if (this._converationInputControllers[id]) {
        this._converationInputControllers[id].error(
          new Error("Failed to create conversation turn")
        );
      }
      throw new Error("Failed to create conversation turn");
    }

    this._converationOutputControllers[id]?.enqueue({
      turn: created,
      nextTurn: nextTurn,
    });

    if (nextTurn === null) {
      // TODO: Close the conversation
      // TODO: Update the material status

      this._converationInputControllers[id]?.close();
      delete this._converationInputControllers[id];

      this._converationOutputControllers[id]?.close();
      delete this._converationOutputControllers[id];

      await Material.findByIdAndUpdate(args.materialId, {
        $set: {
          status: "COMPLETED",
        },
      });
    }

    return {
      turn: created,
      nextTurn: nextTurn,
    };
  }

  static async *startConversation(input: {
    materialId: ObjectId;
    user: WithId<IUser>;
  }): AsyncGenerator<{
    turn: WithId<IConversationTurn> | null;
    nextTurn: string | null;
  }> {
    let material = await Material.findById(input.materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    const userPath = await UserPath.findById(material.path_ID);
    if (!userPath) {
      throw new Error("User path not found");
    }

    const journey = await Journey.findById(material.journey_ID);
    if (!journey) {
      throw new Error("Journey not found");
    }

    const id = input.materialId.toHexString();

    const inputStream = new ReadableStream<WithId<IConversationTurn>>({
      start: (controller) => {
        this._converationInputControllers[id] = controller;
      },
    });

    const outputStream = new ReadableStream<{
      turn: WithId<IConversationTurn>;
      nextTurn: string | null;
    }>({
      start: (controller) => {
        this._converationOutputControllers[id] = controller;
      },
    });

    if (this._preparingConversations[id]) {
      this._preparingConversations[id].then((v) => {
        material = v;
      });
    }

    new Promise(async (resolve, reject) => {
      try {
        const charactersMsg = await conversationCharactersInstructions({
          conversation: material!,
        });

        for await (const userTurn of inputStream) {
          const builder = new PromptBuilder({
            userName: input.user.name,
            language: journey.to,
          });

          let nextTurn: string | null = null;

          conversationGenInstructions(builder, {
            charactersMsg,
            journey: journey,
            userPath: userPath,
            conversation: material!,
          });

          const turns = await ConversationTurn.find(
            {
              material_ID: input.materialId,
            },
            {
              sort: {
                createdAt: 1,
              },
            }
          );

          for (const turn of turns) {
            const message = msg();
            message.addKv(turn.character, turn.text);

            if (turn.character === "$user") {
              builder.userMessage(message, {
                extra: {
                  tags: [PromptTags.TURNS],
                },
              });
            } else {
              builder.assistantMessage(message, {
                extra: {
                  tags: [PromptTags.TURNS],
                },
              });
            }
          }

          in_while: do {
            const createdRes = await AIModel.generateConversationTurn(
              builder,
              material!,
              journey,
              nextTurn
            );

            nextTurn = (
              await this._createTurnForAI({
                materialId: input.materialId,
                res: createdRes,
                language: journey.to,
              })
            ).nextTurn;

            if (nextTurn === "$user") {
              break in_while;
            }
          } while (nextTurn !== null && nextTurn !== "$user");
        }

        resolve(null);
      } catch (e) {
        console.error(e);
        reject(e);
      }
    });

    // Ready signal
    yield {
      turn: null,
      nextTurn: null,
    };

    for await (const output of outputStream) {
      yield output;
    }

    return;
  }

  static async addUserInput(input: {
    materialId: ObjectId;
    audio_ID?: ObjectId;
    text?: string;
  }) {
    const id = input.materialId.toHexString();

    let text: string | undefined = input.text;
    let analyze: any | undefined = undefined;

    if (!text) {
      const res = await AzureVoice.speechToText(
        await StorageService.getAudio(input.audio_ID!)
      );

      text = res.text;
      analyze = res.analyze;
    }

    const created = await ConversationTurn.insertOne({
      material_ID: input.materialId,
      character: "$user",
      text,
      audio_ID: input.audio_ID || undefined,
      analyze,
    });

    if (!created) {
      throw new Error("Failed to add user input");
    }

    if (!this._converationInputControllers[id]) {
      await ConversationTurn.findByIdAndDelete(created._id);
      throw new Error(
        "Conversation input controller not found. Please listen first"
      );
    }

    this._converationInputControllers[id]?.enqueue(created);

    return created;
  }

  static _converationInputControllers: {
    [key: string]: ReadableStreamDefaultController<WithId<IConversationTurn>>;
  } = {};

  static _converationOutputControllers: {
    [key: string]: ReadableStreamDefaultController<{
      turn: WithId<IConversationTurn>;
      nextTurn: string | null;
    }>;
  } = {};
}
