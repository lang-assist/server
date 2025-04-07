import { ObjectId, WithId } from "mongodb";
import crypto from "crypto";
import {
  Docs,
  DocSearch,
  DocTemplate,
  IDocs,
  IDocTemplate,
  IJourney,
  IStagePart,
  IUserDoc,
  UserDoc,
} from "../../models/_index";
import { instructions as mainInstructions } from "../prompts";
import { VectorStore } from "../vectors";
import {
  ChatGeneration,
  ChatGenerationContext,
  ChatGenerationContextWithGlobalAssistant,
} from "../ai/chat/base";
import { BrocaTypes } from "../../types";
import { SpeechGeneration } from "../ai/voice/base";
import { ImageGeneration } from "../ai/img/base";
import { undefinedOrValue } from "../../utils/validators";
import { MessageBuilder, msg, PromptBuilder } from "../../utils/prompter";
import { AIModels } from "../../utils/constants";
import { VoiceManager } from "../voice";
import { WithGQLID } from "../db";
import { AIError } from "../../utils/ai-types";

function hash(text: string, aiModel: string): string {
  return crypto.createHash("md5").update(`${text}-${aiModel}`).digest("hex");
}

class GlobalDocumentationCtx extends ChatGenerationContextWithGlobalAssistant {
  toJSON() {
    return {
      ...super.toJSON(),
      language: this.language,
      requested: this.journey.user_ID,
      searchTerm: this.searchTerm,
      title: this.title,
      searchHash: this.searchHash,
      foundDocs: this.foundDocs,
      generatedTemplateId: this.generatedTemplateId,
      referencedTemplateId: this.referencedTemplateId,
    };
  }

  public foundDocs: {
    id: ObjectId;
    distance: number;
  }[] = [];

  public generatedTemplateId: string | null = null;
  public referencedTemplateId: string | null = null;

  public userDoc: WithId<IUserDoc> | null = null;

  public get language(): string {
    return this.journey.to;
  }

  public get chatModel(): keyof typeof AIModels.chat {
    return this.journey.chatModel! as keyof typeof AIModels.chat;
  }

  public get ttsModel(): keyof typeof AIModels.tts {
    return this.journey.ttsModel! as keyof typeof AIModels.tts;
  }

  public get imgModel(): keyof typeof AIModels.img {
    return this.journey.imageGenModel! as keyof typeof AIModels.img;
  }

  public constructor(
    public readonly journey: WithId<IJourney>,
    public searchTerm: string,
    public title: string,
    public searchHash: string,
    public generatingDoc: Partial<IDocTemplate> | null = null,
    public generatingExplanations: BrocaTypes.Documentation.Explanation[] = []
  ) {
    super("documentation", "documentation");
  }
}

export class GlobalDocumentationManager {
  private static _preparingDocuments: {
    [key: string]: GlobalDocumentationCtx;
  } = {};

  static async addDocToUser(
    doc: WithId<IDocTemplate> | ObjectId,
    journey: WithId<IJourney>
  ) {
    const userDoc = await UserDoc.findOne({
      template_ID: doc instanceof ObjectId ? doc : doc._id,
      journey_ID: journey._id,
      user_ID: journey.user_ID,
    });

    if (userDoc) {
      return userDoc;
    } else {
      const created = await UserDoc.insertOne({
        template_ID: doc instanceof ObjectId ? doc : doc._id,
        journey_ID: journey._id,
        user_ID: journey.user_ID,
      });

      if (!created) {
        throw new Error("Failed to insert user doc");
      }

      return created;
    }
  }

  static async findOrCreateDocumentation(input: {
    journey: WithId<IJourney>;
    title: string;
    searchTerm: string;
  }): Promise<WithId<IUserDoc>> {
    const searchHash = hash(input.searchTerm, input.journey.chatModel);

    const existingCtx = this._preparingDocuments[searchHash];

    if (existingCtx) {
      await existingCtx.waitUntil("generated");
      return existingCtx.userDoc!;
    }

    // Önce search hash'e bakalım
    const existingDoc = await DocSearch.findOne({
      hashWithAiModel: searchHash,
    });

    if (existingDoc) {
      return await this.addDocToUser(existingDoc.doc_ID, input.journey);
    }

    const ctx = new GlobalDocumentationCtx(
      input.journey,
      input.searchTerm,
      input.title,
      searchHash
    );

    this._preparingDocuments[searchHash] = ctx;

    this._findOrCreateDocumentation(ctx);

    await ctx.waitUntil("generated");

    return ctx.userDoc!;
  }

  private static summarizeDoc(doc: WithId<IDocTemplate>): MessageBuilder {
    const docMsg = msg();

    docMsg.addKv("ID", doc._id.toHexString());
    docMsg.addKv("Title", doc.title);
    docMsg.addKv("Description", doc.description);
    docMsg.addKv("Includes", doc.includes.join(", "));

    return docMsg;
  }

  public static async getTenVoiceMessage(language: string) {
    const voices = await VoiceManager.getTenVoiceFor(language);

    const voicesMsg = msg("Available voices:");

    for (const voice of voices ?? []) {
      voicesMsg.addKv(
        `Voice '${voice.shortName}'`,
        msg().addKv("Styles", voice.styles.join(", "))
      );
    }

    return voicesMsg;
  }

  private static async _findOrCreateDocumentation(
    ctx: GlobalDocumentationCtx
  ): Promise<void> {
    ctx.startGeneration();

    const vectorStore = VectorStore.getStore<{
      summary: string;
    }>("doc_embeddings");

    const similarDocs = await vectorStore.search(ctx, ctx.searchTerm, {
      maxDistance: 0.6,
      limit: 5,
    });

    ctx.foundDocs = similarDocs.map((doc) => ({
      id: doc.id,
      distance: doc.distance,
    }));

    const builder = new PromptBuilder();

    const inst = mainInstructions.documentation;

    builder.systemMessage(inst.content, "assistant", inst.version, {
      cache: true,
    });

    const voicesMsg = await this.getTenVoiceMessage(ctx.language);

    builder.systemMessage(voicesMsg, "assistant", 1, {
      cache: true,
    });

    if (similarDocs.length > 0) {
      builder.assistantMessage((m) => {
        for (const doc of similarDocs) {
          m.addKv(`Summary of ${doc.id}`, doc.metadata.summary);
        }
      });
    } else {
      builder.assistantMessage("No similar documents found locally.");
    }

    const doMsg = msg();

    doMsg.add("Please do one of the following with the following input:");

    doMsg.add("1. Generate new documentation");
    doMsg.add(
      "2. Reference an existing documentation with and section (if locally found)"
    );
    doMsg.add(
      "3. If current documentation is related but not enough, generate new section and refer to existing documentation and (if it will be a sub section)section that new section is added to"
    );

    builder.userMessage(doMsg, {
      cache: false,
    });

    const inputMsg = msg();

    inputMsg.addKv("Language", msg(`\`\`\`${ctx.language}\`\`\``));
    inputMsg.addKv("Title", msg(`\`\`\`${ctx.title}\`\`\``));
    inputMsg.addKv("Search term", msg(`\`\`\`${ctx.searchTerm}\`\`\``));

    builder.userMessage(inputMsg, {
      cache: false,
    });

    const generation = new ChatGeneration<"documentation">(
      "documentation",
      builder,
      ctx
    );

    const aiResult = await generation.generate(async (m) => {
      if (m.type === "existingDoc") {
        ctx.referencedTemplateId = m.payload;
        if (!ObjectId.isValid(m.payload)) {
          throw new Error("DOC ID INVALID");
        }

        const doc = await DocTemplate.findById(new ObjectId(m.payload));

        if (!doc) {
          throw new Error("Referenced document not found");
        }

        ctx.userDoc = await this.addDocToUser(doc, ctx.journey);
        await ctx.complete();

        return;
      }

      if (m.type === "doc_meta") {
        ctx.generatingDoc = m.payload;
      }

      if (m.type === "explanation") {
        ctx.generatingExplanations.push(m.payload);
      }
    });

    let docId: ObjectId | null = null;

    if (ctx.generatingDoc) {
      const createdDoc = await DocTemplate.insertOne({
        aiModel: ctx.journey.chatModel,
        language: ctx.journey.to,
        global: true,
        ...ctx.generatingDoc,
        explanations: ctx.generatingExplanations,
      });

      if (!createdDoc) {
        throw new Error("Failed to insert new document");
      }

      docId = createdDoc._id;

      const promises = await this.modifyDocAndCacheVector(
        ctx,
        vectorStore,
        createdDoc._id
      );

      ctx.addPostGen(...promises);

      ctx.complete();

      return;
    } else if (ctx.referencedTemplateId) {
      const doc = await DocTemplate.findById(
        new ObjectId(ctx.referencedTemplateId)
      );

      if (!doc) {
        throw new Error("Referenced document not found");
      }

      docId = doc._id;
    } else {
      throw new Error("No document to generate");
    }
    // TODO: Store the search hash & vector store
    await DocSearch.insertOne({
      hashWithAiModel: ctx.searchHash,
      doc_ID: docId,
    });

    ctx.userDoc = await this.addDocToUser(docId, ctx.journey);

    ctx.complete();

    return;
  }

  private static async modifyDocAndCacheVector(
    ctx: GlobalDocumentationCtx,
    vectorStore: VectorStore<{
      summary: string;
    }>,
    docId: ObjectId
  ): Promise<Promise<any>[]> {
    const doc = await DocTemplate.findById(docId);
    if (!doc) {
      throw new Error("Document not found");
    }

    const modified = this._recursiveUpdate(ctx, {
      explanations: doc.explanations,
    });

    const promises: Promise<any>[] = modified.promises;

    const updated = await DocTemplate.findByIdAndUpdate(docId, {
      $set: { explanations: modified.explanations },
    });

    if (!updated) {
      throw new Error("Document not found");
    }

    const docMsg = this.summarizeDoc(updated).build();

    vectorStore.addEntry(ctx, doc._id, docMsg, {
      summary: docMsg,
    });

    return promises;
  }

  public static _recursiveUpdate(
    ctx: ChatGenerationContext,
    input: {
      explanations: BrocaTypes.Documentation.Explanation[];
    }
  ): {
    explanations: BrocaTypes.Documentation.Explanation[];
    promises: Promise<any>[];
  } {
    const explanations = input.explanations;

    const promises: Promise<any>[] = [];

    if (explanations) {
      for (var i = 0; i < explanations.length; i++) {
        const explanation = explanations[i];

        switch (explanation.type) {
          case "text":
            break;
          case "picture":
            if (
              explanation.content &&
              (explanation.pictureId === undefined ||
                explanation.pictureId === null)
            ) {
              const id = new ObjectId();
              const gen = new ImageGeneration(explanation.content, id, ctx, {
                reason: "explanation",
                produced: id,
              });

              promises.push(gen.generate());

              explanation.pictureId = gen.fileId.toHexString();
            }
          case "audio":
            if (
              explanation.content &&
              (explanation.audioId === undefined ||
                explanation.audioId === null)
            ) {
              const id = new ObjectId();
              const gen = new SpeechGeneration(
                explanation.content,
                id,
                ctx.language,
                ctx,
                {
                  reason: "explanation",
                  produced: id,
                }
              );

              promises.push(gen.generate());

              explanation.audioId = gen.fileId.toHexString();
            }
        }

        explanations[i] = explanation;
      }
    }

    return {
      explanations,
      promises,
    };
  }
}

class StageDocumentationCtx extends ChatGenerationContextWithGlobalAssistant {
  public generatingExplanations: BrocaTypes.Documentation.Explanation[] = [];
  public generatedDoc: WithGQLID<IDocs> | null = null;

  public constructor(
    public readonly journey: WithId<IJourney>,
    public title: string,
    public instructions: string
  ) {
    super("documentation", "documentation");
  }

  public get chatModel(): keyof typeof AIModels.chat {
    return this.journey.chatModel! as keyof typeof AIModels.chat;
  }

  public get language(): string {
    return this.journey.to;
  }
}

export class StageDocumentationManager {
  static _generatingRefs: {
    [key: string]: StageDocumentationCtx;
  } = {};

  static async genUserDoc(
    journey: WithId<IJourney>,
    part: WithGQLID<IStagePart>,
    generatingDoc: WithGQLID<IDocs>
  ): Promise<WithGQLID<IDocs>> {
    const refId = generatingDoc._id.toHexString();

    if (this._generatingRefs[refId]) {
      await this._generatingRefs[refId].waitUntil("generated");
      return this._generatingRefs[refId].generatedDoc!;
    }

    try {
      const {
        documentation: { title, instructions },
      } = part;

      const builder = new PromptBuilder();

      const inst = mainInstructions.documentation;

      builder.systemMessage(inst.content, "assistant", inst.version, {
        cache: true,
      });

      const voicesMsg = await GlobalDocumentationManager.getTenVoiceMessage(
        journey.to
      );

      builder.systemMessage(voicesMsg, "assistant", 1, {
        cache: true,
      });

      const inputMsg = msg();

      inputMsg.add(`<target-language>${journey.to}</target-language>`);
      inputMsg.add(`<title>${title}</title>`);
      inputMsg.add(`<doc-instructions>${instructions}</doc-instructions>`);

      builder.userMessage(
        `<request>${inputMsg.build()}</request><additinal-instruction>No need doc meta, return only explanations</additinal-instruction>`,
        {
          cache: false,
        }
      );

      const ctx = new StageDocumentationCtx(journey, title, instructions);

      this._generatingRefs[refId] = ctx;

      ctx.startGeneration();

      const generation = new ChatGeneration<"documentation">(
        "documentation",
        builder,
        ctx
      );

      await generation.generate(async (m) => {
        if (m.type === "existingDoc") {
          throw new Error("Existing doc not supported");
        }

        if (m.type === "explanation") {
          ctx.generatingExplanations.push(m.payload);
        }
      });

      const newd = ctx.generatingExplanations;

      if (!newd || newd.length === 0) {
        const error = new AIError("Failed to generate user doc");
        ctx.addError(error);
        throw error;
      }

      const updatedData = GlobalDocumentationManager._recursiveUpdate(ctx, {
        explanations: newd,
      });

      ctx.addPostGen(...updatedData.promises);

      const updatedDoc = await Docs.findByIdAndUpdate(generatingDoc._id, {
        $set: {
          explanations: updatedData.explanations,
          genStatus: "GENERATED",
        },
      });

      if (!updatedDoc) {
        const error = new AIError("Failed to insert user doc");
        ctx.addError(error);
        throw error;
      }

      ctx.generatedDoc = updatedDoc;

      await ctx.complete();

      return updatedDoc;
    } catch (e) {
      throw e;
    } finally {
      delete this._generatingRefs[refId];
    }
  }
}
