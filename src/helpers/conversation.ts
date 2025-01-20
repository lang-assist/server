import { ObjectId, WithId } from "mongodb";
import {
  ConversationTurn,
  IConversationTurn,
  IMaterial,
  IUser,
  Journey,
  Material,
  User,
  UserPath,
  Voices,
} from "../models/_index";
import { AIEmbeddingGenerator, AIModel } from "./ai/base";
import { AIMessages, ConversationDetails } from "../utils/types";
import { summarizeMaterial } from "./instructions";
import { journeyInstructions } from "./instructions";
import { StorageService } from "./storage";
import { AzureVoice } from "./voice/azure";
import { AIConversationTurnResponse } from "../utils/ai-types";
import { AudioHelper } from "./audio";
import { PromptBuilder } from "../utils/prompt-builder";

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

    if (material.preparing === false || material.preparing === true) {
      return material;
    }

    const promise = (async () => {
      await Material.findByIdAndUpdate(materialId, {
        $set: {
          preparing: true,
        },
      });

      let conversation = await Material.findById(materialId);

      if (!conversation) {
        throw new Error("Conversation not found");
      }

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

      const conversationCharacters = (
        conversation.details as ConversationDetails
      ).characters;

      const charactersInstructionsResult = await Promise.all(
        Object.entries(characters).map(async ([key, value]) => {
          const voice = await Voices.findById(new ObjectId(value));
          if (!voice) {
            throw new Error("Voice not found");
          }

          const character = conversationCharacters.find((c) => c.name === key);
          if (!character) {
            throw new Error("Character not found");
          }

          return {
            [key]: AIEmbeddingGenerator.voiceInstructions(voice, {
              overrideSingleLocale: character.locale,
              withStyles: true,
              withShortName: true,
              withPersonalities: false,
              withSecondaryLocales: false,
              withTailoredScenarios: false,
            }),
          };
        })
      );

      const charactersInstructions = Object.assign(
        {},
        ...charactersInstructionsResult
      );

      const builder = new PromptBuilder();

      await journeyInstructions(builder, {
        journey: journey,
        userPath: userPath,
      });

      summarizeMaterial(builder, {
        details: conversation.details,
        metadata: conversation.metadata,
      });

      builder.systemMessage(`USER NAME: ${user.name}`);

      const prepareRes = await AIModel.prepareConversation(
        builder,
        conversation,
        journey
      );

      conversation = prepareRes.material;

      let nextTurn: string | null = null;

      do {
        const createRes = await AIModel.generateConversationTurn(
          conversation,
          journey,
          nextTurn,
          undefined
        );

        nextTurn = (
          await this._createTurnForAI({
            materialId: conversation._id,
            res: createRes,
          })
        ).nextTurn;
      } while (nextTurn !== null && nextTurn !== "$user");

      await Material.findByIdAndUpdate(conversation._id, {
        $set: {
          preparing: false,
        },
      });

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

    console.log(
      "OUT TO STREAM CONTROLLER",
      this._converationOutputControllers[id]
    );

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

    if (material.preparing === undefined || material.preparing === null) {
      this.prepareConversation(input.materialId, input.user).then((v) => {
        material = v;
      });
    }

    if (this._preparingConversations[id]) {
      this._preparingConversations[id].then((v) => {
        material = v;
      });
    }

    new Promise(async (resolve, reject) => {
      try {
        for await (const userTurn of inputStream) {
          let nextTurn: string | null = null;

          in_while: do {
            const createdRes = await AIModel.generateConversationTurn(
              material!,
              journey,
              nextTurn,
              userTurn
            );

            nextTurn = (
              await this._createTurnForAI({
                materialId: input.materialId,
                res: createdRes,
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
      console.log("OUT TO STREAM", output);
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

    console.log(created, this._converationInputControllers[id]);

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
