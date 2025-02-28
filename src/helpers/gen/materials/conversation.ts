import { ObjectId, WithId } from "mongodb";
import {
  ConversationTurn,
  IConversationTurn,
  IJourney,
  IMaterial,
  IUser,
  Journey,
  Material,
  Voices,
} from "../../../models/_index";
import { GenerationContext } from "../../../types/ctx";
import { BrocaTypes } from "../../../types";
import { VoiceManager } from "./../../voice";
import {
  ChatGeneration,
  SpeechGeneration,
  TranscriptionGeneration,
} from "./../../ai";
import { undefinedOrValue } from "../../../utils/validators";
import { StorageService } from "../../storage";
import { msg, PromptBuilder } from "../../../utils/prompter";
import { ChatGenerationContextWithGlobalAssistant } from "../../ai/chat/base";
import { AIModels } from "../../../utils/constants";
import { WithGQLID } from "../../db";
import {
  describeMaterial,
  instructions,
  summarizeConversationTurn,
} from "../../prompts";
import { VoiceStore } from "../../vectors/stores/voice";
import { randomString } from "../../../utils/random";

type ConversationCtxStatus =
  | "not-started"
  | "voice-selecting"
  | "ready"
  | "conversation"
  | "completed";

class ConversationFlow {
  public flowId = randomString(32);

  static async create(args: {
    materialOrID: WithId<IMaterial> | ObjectId;
    user: WithId<IUser>;
  }): Promise<ConversationFlow> {
    let material: WithId<IMaterial> | null = null;

    if (args.materialOrID instanceof ObjectId) {
      material = await Material.findById(args.materialOrID);
    } else {
      material = args.materialOrID;
    }

    if (!material) {
      throw new Error("Material not found");
    }

    const journey = await Journey.findById(material.journey_ID);
    if (!journey) {
      throw new Error("Journey not found");
    }

    const turns = await ConversationTurn.find(
      {
        material_ID: material._id,
      },
      {
        sort: {
          createdAt: -1,
        },
      }
    );

    return new ConversationFlow({
      material: material!,
      journey: journey!,
      pathID: material.pathID,
      user: args.user,
      turns: turns,
    });
  }

  constructor(args: {
    material: WithId<IMaterial>;
    journey: WithId<IJourney>;
    pathID: string;
    user: WithId<IUser>;
    turns: WithId<IConversationTurn>[];
  }) {
    let stat: ConversationCtxStatus = "not-started";

    if (args.material.convStatus === "COMPLETED") {
      stat = "completed";
    } else if (args.turns.length > 0) {
      stat = "conversation";
    } else if (
      (
        args.material
          .details as BrocaTypes.Material.Conversation.ConversationDetails
      ).voices
    ) {
      stat = "ready";
    }

    this.status = stat;
    this.material = args.material;
    this.journey = args.journey;
    this.pathID = args.pathID;
    this.user = args.user;
    this.turns = args.turns;
  }

  public inputController: ReadableStreamDefaultController<
    WithId<IConversationTurn>
  > | null = null;
  public outputController: ReadableStreamDefaultController<{
    turn: WithId<IConversationTurn>;
    nextTurn: string | null;
  }> | null = null;

  private _activeContexts: {
    preperation: ConversationPreperationCtx | null;
    turn: ConversationTurnCtx | null;
  } = {
    preperation: null,
    turn: null,
  };

  public getPreperationCtx(): ConversationPreperationCtx | null {
    if (!this._activeContexts.preperation) {
      if (["not-started", "voice-selecting"].includes(this.status)) {
        const ctx = new ConversationPreperationCtx(this);
        this.setPreperationCtx(ctx);
      } else {
        return null;
      }
    }
    return this._activeContexts.preperation!;
  }

  public async createTurnCtx(): Promise<ConversationTurnCtx | null> {
    if (this._activeContexts.turn) {
      const ctx = this._activeContexts.turn;

      await this._activeContexts.turn!.waitUntil("generated");
    }

    const ctx = new ConversationTurnCtx(this);

    this.setTurnCtx(ctx);

    return ctx;
  }

  public setPreperationCtx(ctx: ConversationPreperationCtx) {
    if (this._activeContexts.preperation) {
      throw new Error("Preperation context already set");
    }
    this._activeContexts.preperation = ctx;
    ctx.waitUntil("completed").finally(() => {
      this._activeContexts.preperation = null;
    });
  }

  public setTurnCtx(ctx: ConversationTurnCtx) {
    const compStat = ["completed", "error"];
    if (
      this._activeContexts.turn &&
      !compStat.includes(this._activeContexts.turn.status)
    ) {
      throw new Error("Turn context already set");
    }

    this._activeContexts.turn = ctx;
    ctx.waitUntil("completed").finally(() => {
      this._activeContexts.turn = null;
    });
  }

  public status: ConversationCtxStatus;

  public material: WithId<IMaterial>;

  public journey: WithId<IJourney>;

  public pathID: string;

  public user: WithId<IUser>;

  // public voices: {
  //   [key: string]: {
  //     voiceId: string;
  //     instructions: string;
  //   };
  // } = {};

  // public instructions: string | null = null;

  public turns: WithId<IConversationTurn>[] = [];

  public async insertAITurn(turn: {
    turn: BrocaTypes.Material.Conversation.ConversationTurn;
    nextTurn: string | null;
    audioId: ObjectId;
  }) {
    const created = await ConversationTurn.insertOne({
      material_ID: this.material._id,
      character: turn.turn.character,
      text: turn.turn.text,
      ssml: turn.turn.ssml,
      audio_ID: turn.audioId,
      nextTurn: turn.nextTurn,
    });

    if (!created) {
      throw new Error("Failed to insert turn");
    }

    this.turns.push(created);

    if (this.outputController) {
      this.outputController.enqueue({
        turn: created,
        nextTurn: turn.nextTurn,
      });
    }

    if (this.nextTurn === null) {
      this.outputController?.close();
      this.inputController?.close();
      this.outputController = null;
      this.inputController = null;
      this.status = "completed";
      const updated = await Material.findByIdAndUpdate(this.material._id, {
        $set: {
          convStatus: "COMPLETED",
        },
      });

      if (!updated) {
        throw new Error("Failed to update material");
      }

      this.material = updated;
    }
  }

  public async insertUserTurn(turn: {
    audio_ID?: ObjectId;
    text: string;
    analyze: any;
  }): Promise<WithGQLID<IConversationTurn>> {
    const created = await ConversationTurn.insertOne({
      material_ID: this.material._id,
      character: "$user",
      text: turn.text,
      audio_ID: turn.audio_ID,
      analyze: turn.analyze,
    });

    if (!created) {
      throw new Error("Failed to insert user turn");
    }

    this.turns.push(created);

    this.inputController?.enqueue(created);

    return created;
  }

  public get nextTurn(): "ai" | "user" | null {
    if (this.turns.length === 0) {
      return "ai";
    }

    const lastTurn = this.turns[this.turns.length - 1];


    if (lastTurn.character === "$user") {
      return "ai";
    }

    if (lastTurn.nextTurn) {
      return lastTurn.nextTurn === "$user" ? "user" : "ai";
    }

    return null;
  }

  public async setThread(threadId: string): Promise<void> {
    const updated = await Material.findByIdAndUpdate(this.material._id, {
      $set: {
        threadId,
      },
    });

    if (!updated) {
      throw new Error("Failed to update material");
    }

    this.material = updated;
  }
}

class ConversationPreperationCtx extends GenerationContext {
  constructor(public flow: ConversationFlow) {
    super("idle", "conversationPreperation");
  }

  public selectedVoices: {
    [key: string]: {
      voiceId: string;
      instructions: string;
    };
  } = {};

  toJSON() {
    return {
      selectedVoices: this.selectedVoices,
    };
  }
}

class ConversationTurnCtx extends ChatGenerationContextWithGlobalAssistant {
  public get language(): string {
    return this.flow.journey.to;
  }
  public get chatModel(): keyof typeof AIModels.chat {
    return this.flow.journey.chatModel! as keyof typeof AIModels.chat;
  }

  public get ttsModel(): keyof typeof AIModels.tts {
    return this.flow.journey.ttsModel! as keyof typeof AIModels.tts;
  }

  public get sttModel(): keyof typeof AIModels.stt {
    return this.flow.journey.sttModel! as keyof typeof AIModels.stt;
  }

  constructor(public flow: ConversationFlow) {
    super("conversationTurn", "conversationTurn");
  }

  public get material(): WithId<IMaterial> {
    return this.flow.material;
  }

  public get journey(): WithId<IJourney> {
    return this.flow.journey;
  }

  public get user(): WithId<IUser> {
    return this.flow.user;
  }

  public userTurn: WithId<IConversationTurn> | null = null;

  toJSON() {
    return {
      threadId: this.threadId,
      userTurn: this.userTurn?._id,

      ...super.toJSON(),
    };
  }

  public get threadId(): string | null {
    return this.flow.material.threadId ?? null;
  }

  public createThread(threadId: string): Promise<void> {
    return this.flow.setThread(threadId);
  }
}

export class ConversationManager {
  private static _flows: {
    [key: string]: ConversationFlow;
  } = {};

  static async getFlow(
    materialId: ObjectId,
    user: WithId<IUser>
  ): Promise<ConversationFlow> {
    const id = materialId.toHexString();

    const existing = this._flows[id];

    if (existing) {
      return existing;
    }

    const flow = await ConversationFlow.create({
      materialOrID: materialId,
      user,
    });

    this._flows[id] = flow;

    return flow;
  }

  static async prepareConversationDetails(
    mat: WithId<IMaterial>,
    user: WithId<IUser>
  ): Promise<void> {
    const flow = await this.getFlow(mat._id, user);

    return this.prepareConversation(flow);
  }

  static async prepareConversation(flow: ConversationFlow): Promise<void> {
    const preperationCtx = flow.getPreperationCtx();

    if (!preperationCtx) {
      return;
    }

    const details = preperationCtx.flow.material
      .details as BrocaTypes.Material.Conversation.ConversationDetails;

    if (!details.characters) {
      throw new Error("Characters not found");
    }

    const chars = details.characters.filter((c) => c.name !== "$user");

    preperationCtx.startGeneration();

    const voices = await Promise.all(
      chars.map(async (c) => {
        return {
          character: c.name,
          voice: await VoiceManager.selectVoice(preperationCtx, details, c),
        };
      })
    );

    const vcs: {
      [key: string]: {
        voiceId: string;
        instructions: string;
      };
    } = {};

    for (const v of voices) {
      const char = details.characters.find((c) => c.name === v.character);

      if (!char) {
        throw new Error("Character not found");
      }

      vcs[v.character] = {
        voiceId: v.voice._id.toHexString(),
        instructions: VoiceStore.voiceInstructions(v.voice, {
          overrideSingleLocale: char.locale,
          withPersonalities: false,
          withSecondaryLocales: false,
          withShortName: true,
          withStyles: true,
          withTailoredScenarios: false,
        }).build(),
      };
    }

    preperationCtx.selectedVoices = vcs;

    const updated = await Material.findByIdAndUpdate(
      preperationCtx.flow.material._id,
      {
        $set: {
          // @ts-ignore
          "details.voices": vcs,
        },
      }
    );

    if (!updated) {
      throw new Error("Failed to update material");
    }

    preperationCtx.flow.material = updated;

    await preperationCtx.complete();

    return;
  }

  private static _aiTurnPrompt(
    flow: ConversationFlow,
    turnCtx: ConversationTurnCtx
  ): PromptBuilder {
    const builder = new PromptBuilder({
      userName: turnCtx.user.name,
      language: turnCtx.journey.to,
    });

    const ins = instructions.conversation_turn;

    builder.systemMessage(ins.content, "assistant", ins.version, {
      cache: true,
    });

    const detailsMsg = describeMaterial(flow.material);

    builder.systemMessage(detailsMsg, "thread", 1, {
      cache: true,
    });

    const turnCount = flow.turns.length;

    if (turnCount === 0) {
      builder.userMessage("Conversation not started yet", {
        addedToThread: false,
      });
    } else {
      const lastTurn = flow.turns[turnCount - 1];
      if (lastTurn.nextTurn) {
        builder.userMessage(`Next Turn Character: ${lastTurn.nextTurn}.`, {
          addedToThread: false,
        });
      } else {
        builder.userMessage("Define the turn character yourself.", {
          addedToThread: false,
        });
      }
    }

    let i = 0;

    for (const t of flow.turns) {
      const isLast = i === flow.turns.length - 1;
      const turnDesc = summarizeConversationTurn(t);

      if (t.character === "$user") {
        builder.userMessage(turnDesc, {
          addedToThread: !isLast,
        });
      } else {
        builder.assistantMessage(turnDesc, {
          addedToThread: !isLast,
        });
      }
      i++;
    }

    return builder;
  }

  private static async _createTurnForAI(flow: ConversationFlow): Promise<void> {
    const turnCtx = await flow.createTurnCtx();

    if (!turnCtx) {
      throw new Error("Turn context not found");
    }

    if (turnCtx.status === "completed") {
      return;
    }

    const builder = this._aiTurnPrompt(flow, turnCtx);

    turnCtx.startGeneration();

    // TODO: Add characters instructions
    const gen = new ChatGeneration("conversationTurn", builder, turnCtx);

    const res = await gen.generate();

    const turn = undefinedOrValue(res.turn, null);

    const nextTurn = undefinedOrValue(res.nextTurn, null);

    if (!turn) {
      throw new Error("Unexpected error");
    }

    if (!turn.ssml) {
      throw new Error("Unexpected error");
    }

    const audioId = new ObjectId();

    const audioGen = new SpeechGeneration(
      turn.ssml,
      audioId,
      turnCtx.language,
      turnCtx,
      {
        reason: "conversationTurn",
        produced: audioId,
      }
    );

    const audPromise = audioGen.generate();

    turnCtx.addPostGen(audPromise);

    await flow.insertAITurn({
      turn,
      nextTurn,
      audioId,
    });

    await turnCtx.complete();

    // const created = await ConversationTurn.insertOne({
    //   material_ID: turnCtx.material._id,
    //   character: turn.character,
    //   text: turn.text,
    //   ssml: turn.ssml,
    //   audio_ID: audioId,
    //   nextTurn: nextTurn,
    // });

    // const id = ctx.material._id.toHexString();

    // if (!created) {
    //   if (this._converationInputControllers[id]) {
    //     this._converationInputControllers[id].error(
    //       new Error("Failed to create conversation turn")
    //     );
    //   }
    //   throw new Error("Failed to create conversation turn");
    // }

    // this._converationOutputControllers[id]?.enqueue({
    //   turn: created,
    //   nextTurn: nextTurn,
    // });

    // if (nextTurn === null) {
    //   // TODO: Close the conversation
    //   // TODO: Update the material status

    //   this._converationInputControllers[id]?.close();
    //   delete this._converationInputControllers[id];

    //   this._converationOutputControllers[id]?.close();
    //   delete this._converationOutputControllers[id];

    //   await Material.findByIdAndUpdate(ctx.material._id, {
    //     $set: {
    //       convStatus: "COMPLETED",
    //     },
    //   });
    // }

    // audPromise.finally(() => {
    //   ctx.status = "completed";
    // });

    // return {
    //   turn: created,
    //   nextTurn: nextTurn,
    // };
  }

  private static async _genFirstTurn(flow: ConversationFlow) {
    await this.prepareConversation(flow);

    while (flow.nextTurn === "ai") {
      await this._createTurnForAI(flow);
    }

    return;
  }

  static async generateFirstTurns(materialId: ObjectId, user: WithId<IUser>) {
    const flow = await this.getFlow(materialId, user);
    await this._genFirstTurn(flow);
  }

  static async *startConversation(input: {
    materialId: ObjectId;
    user: WithId<IUser>;
  }): AsyncGenerator<{
    turn: WithId<IConversationTurn> | null;
    nextTurn: string | null;
  }> {
    const flow = await this.getFlow(input.materialId, input.user);

    if (flow.status === "completed") {
      throw new Error("Conversation completed");
    }

    const inputStream = new ReadableStream<WithId<IConversationTurn>>({
      start: (controller) => {
        flow.inputController = controller;
      },
    });

    const outputStream = new ReadableStream<{
      turn: WithId<IConversationTurn>;
      nextTurn: string | null;
    }>({
      start: (controller) => {
        flow.outputController = controller;
      },
    });


    if (flow.status === "not-started" || flow.status === "ready") {
      this._genFirstTurn(flow);
    }

    const prom = new Promise(async (resolve, reject) => {
      try {
        for await (const _ of inputStream) {
          while (flow.nextTurn === "ai") {
            await this._createTurnForAI(flow);
          }
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

    prom.finally(() => {
    });

    await prom;

    delete this._flows[flow.flowId];

    return;
  }

  static async addUserInput(
    user: WithId<IUser>,
    input: {
      materialId: ObjectId;
      audio_ID?: ObjectId;
      text?: string;
    }
  ): Promise<WithGQLID<IConversationTurn>> {
    const flow = await this.getFlow(input.materialId, user);

    if (flow.status === "completed") {
      throw new Error("Conversation completed");
    }
    const turnCtx = await flow.createTurnCtx();

    if (!turnCtx) {
      throw new Error("Turn context not found");
    }

    turnCtx.startGeneration();

    let text: string | undefined = input.text;
    let analyze: any | undefined = undefined;

    if (!text) {
      const file = await StorageService.getAudio(input.audio_ID!);

      if (!file) {
        throw new Error("Audio file not found");
      }

      const res = await new TranscriptionGeneration(file, turnCtx, {
        reason: "conversationTurn",
        produced: input.audio_ID!,
      }).generate();

      text = res.transcription;
      analyze = res.analyze;
    }

    const created = await flow.insertUserTurn({
      audio_ID: input.audio_ID,
      text,
      analyze,
    });

    await turnCtx.complete();

    return created;
  }

  //   static _converationInputControllers: {
  //     [key: string]: ReadableStreamDefaultController<WithId<IConversationTurn>>;
  //   } = {};

  //   static _converationOutputControllers: {
  //     [key: string]: ReadableStreamDefaultController<{
  //       turn: WithId<IConversationTurn>;
  //       nextTurn: string | null;
  //     }>;
  //   } = {};
}
