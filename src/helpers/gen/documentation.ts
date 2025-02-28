import { ObjectId, WithId } from "mongodb";
import crypto from "crypto";
import {
  DocSearch,
  DocTemplate,
  IDocTemplate,
  IJourney,
  IUserDoc,
  UserDoc,
  Voices,
} from "../../models/_index";
import { instructions } from "../prompts";
import { VectorStore } from "../vectors";
import {
  ChatGeneration,
  ChatGenerationContextWithGlobalAssistant,
} from "../ai/chat/base";
import { BrocaTypes } from "../../types";
import { SpeechGeneration } from "../ai/voice/base";
import { ImageGeneration } from "../ai/img/base";
import { undefinedOrValue } from "../../utils/validators";
import { MessageBuilder, msg, PromptBuilder } from "../../utils/prompter";
import { AIModels } from "../../utils/constants";
import { VoiceManager } from "../voice";

function hash(text: string, aiModel: string): string {
  return crypto.createHash("md5").update(`${text}-${aiModel}`).digest("hex");
}

class DocumentationCtx extends ChatGenerationContextWithGlobalAssistant {
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
    public searchHash: string
  ) {
    super("documentation", "documentation");
  }
}

export class DocumentationManager {
  private static _preparingDocuments: {
    [key: string]: DocumentationCtx;
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

    const ctx = new DocumentationCtx(
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
    ctx: DocumentationCtx
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

    const inst = instructions.documentation;

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

    const aiResult = await generation.generate();

    const existingDoc = undefinedOrValue(aiResult.existingDoc, null);

    // Eğer var olan bir dökümanı referans verdiyse
    if (existingDoc) {
      ctx.referencedTemplateId = existingDoc;

      if (!ObjectId.isValid(existingDoc)) {
        throw new Error("DOC ID INVALID");
      }

      const doc = await DocTemplate.findById(new ObjectId(existingDoc));

      if (!doc) {
        throw new Error("Referenced document not found");
      }

      ctx.userDoc = await this.addDocToUser(doc, ctx.journey);
      await ctx.complete();

      return;
    }

    // Yeni döküman oluştur
    if (!aiResult.newDoc) {
      throw new Error(
        "AI did not generate a new document or reference an existing one"
      );
    }

    const createdDoc = await DocTemplate.insertOne({
      aiModel: ctx.journey.chatModel,
      language: ctx.journey.to,
      ...aiResult.newDoc,
    });

    if (!createdDoc) {
      throw new Error("Failed to insert new document");
    }

    ctx.generatedTemplateId = createdDoc._id.toHexString();

    const promises = await this.modifyDocAndCacheVector(
      ctx,
      vectorStore,
      createdDoc._id
    );

    ctx.addPostGen(...promises);

    // TODO: Store the search hash & vector store
    await DocSearch.insertOne({
      hashWithAiModel: ctx.searchHash,
      doc_ID: createdDoc._id,
    });

    ctx.userDoc = await this.addDocToUser(createdDoc, ctx.journey);

    ctx.complete();

    return;
  }

  private static async modifyDocAndCacheVector(
    ctx: DocumentationCtx,
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

    const updated = await DocTemplate.updateOne(
      { _id: docId },
      { $set: { explanations: modified.explanations } }
    );

    if (!updated) {
      throw new Error("Document not found");
    }

    const docMsg = this.summarizeDoc(updated).build();

    vectorStore.addEntry(ctx, doc._id, docMsg, {
      summary: docMsg,
    });

    return promises;
  }

  private static _recursiveUpdate(
    ctx: DocumentationCtx,
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
              explanation.picturePrompt &&
              (explanation.pictureId === undefined ||
                explanation.pictureId === null)
            ) {
              const id = new ObjectId();
              const gen = new ImageGeneration(
                explanation.picturePrompt,
                id,
                ctx,
                {
                  reason: "explanation",
                  produced: id,
                }
              );

              promises.push(gen.generate());

              explanation.pictureId = gen.fileId.toHexString();
            }
          case "audio":
            if (
              explanation.ssml &&
              (explanation.audioId === undefined ||
                explanation.audioId === null)
            ) {
              const id = new ObjectId();
              const gen = new SpeechGeneration(
                explanation.ssml,
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
