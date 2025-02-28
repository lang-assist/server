import { ObjectId, WithId } from "mongodb";
import crypto from "crypto";
import {
  DictSearch,
  DictTemplate,
  IDictTemplate,
  IJourney,
  IUserDict,
  UserDict,
  Voices,
} from "../../models/_index";
import { instructions } from "../prompts";
import { VectorStore } from "../vectors/stores/base";
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

class DictionaryCtx extends ChatGenerationContextWithGlobalAssistant {
  public constructor(
    public readonly journey: WithId<IJourney>,
    public term: string,
    public searchHash: string
  ) {
    super("dictionary", "dictionary");
  }

  toJSON() {
    return {
      language: this.language,
      requested: this.journey.user_ID,
      term: this.term,
      searchHash: this.searchHash,
      foundDicts: this.foundDicts,
      generatedTemplateId: this.generatedTemplateId,
      referencedTemplateId: this.referencedTemplateId,
      referencedDefinitionId: this.referencedDefinitionId,
      ...super.toJSON(),
    };
  }

  public dict: WithId<IUserDict> | null = null;

  public foundDicts: {
    id: string;
    distance: number;
  }[] = [];

  public generatedTemplateId: string | null = null;
  public referencedTemplateId: string | null = null;
  public referencedDefinitionId: string | null = null;

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
}

export class DictionaryManager {
  private static _preparingDocuments: {
    [key: string]: DictionaryCtx;
  } = {};

  private static async addDictToUser(
    dict: WithId<IDictTemplate> | ObjectId,
    journey: WithId<IJourney>
  ) {
    const userDoc = await UserDict.findOne({
      template_ID: dict instanceof ObjectId ? dict : dict._id,
      journey_ID: journey._id,
      user_ID: journey.user_ID,
    });

    if (userDoc) {
      return userDoc;
    } else {
      const created = await UserDict.insertOne({
        template_ID: dict instanceof ObjectId ? dict : dict._id,
        journey_ID: journey._id,
        user_ID: journey.user_ID,
      });

      if (!created) {
        throw new Error("Failed to insert user dict");
      }

      return created;
    }
  }

  static async findOrCreateDocumentation(input: {
    journey: WithId<IJourney>;
    searchTerm: string;
    termContext: string;
  }): Promise<{
    dict: WithId<IUserDict>;
    definitionId?: string;
  }> {
    const searchHash = hash(input.searchTerm, input.journey.chatModel);

    const existingCtx = this._preparingDocuments[searchHash];

    if (existingCtx) {
      await existingCtx.waitUntil("generated");
      return {
        dict: existingCtx.dict!,
        definitionId: existingCtx.referencedDefinitionId ?? undefined,
      };
    }

    // Önce search hash'e bakalım
    const existingDoc = await DictSearch.findOne({
      hashWithAiModel: searchHash,
    });

    if (existingDoc) {
      return {
        dict: await this.addDictToUser(existingDoc.dict_ID, input.journey),
      };
    }

    const ctx = new DictionaryCtx(input.journey, input.searchTerm, searchHash);

    this._preparingDocuments[searchHash] = ctx;

    this._findOrCreateDocumentation(ctx);

    await ctx.waitUntil("generated");

    return {
      dict: ctx.dict!,
      definitionId: ctx.referencedDefinitionId ?? undefined,
    };
  }

  private static summarizeDict(dict: WithId<IDictTemplate>): MessageBuilder {
    const dictMsg = msg();

    const entry = dict.entry;

    dictMsg.addKv("ID", entry.id);

    dictMsg.addKv(
      "Definitions IDs",
      entry.definitions.map((d) => d.id).join(", ")
    );

    return dictMsg;
  }

  private static async getTenVoiceMessage(language: string) {
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
    ctx: DictionaryCtx
  ): Promise<void> {
    const vectorStore = VectorStore.getStore<{
      summary: string;
    }>("dict_embeddings");

    ctx.startGeneration();

    const similarDicts = await vectorStore.search(ctx, ctx.term, {
      maxDistance: 0.6,
      limit: 5,
    });

    const builder = new PromptBuilder();

    const inst = instructions.documentation;

    builder.systemMessage(inst.content, "assistant", inst.version, {
      cache: true,
    });

    const voicesMsg = await this.getTenVoiceMessage(ctx.language);

    builder.systemMessage(voicesMsg, "assistant", 1, {
      cache: true,
    });

    if (similarDicts.length > 0) {
      builder.assistantMessage((m) => {
        for (const dict of similarDicts) {
          m.addKv(`Summary of ${dict.id}`, dict.metadata.summary);
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
    inputMsg.addKv("Search term", msg(`\`\`\`${ctx.term}\`\`\``));

    builder.userMessage(inputMsg, {
      cache: false,
    });

    const generation = new ChatGeneration<"dictionary">(
      "dictionary",
      builder,
      ctx
    );

    const aiResult = await generation.generate();

    const existingDefinition = undefinedOrValue(
      aiResult.existingDefinition,
      null
    );
    const newDefinition = undefinedOrValue(aiResult.newDefinition, null);

    // Eğer var olan bir dökümanı referans verdiyse
    if (existingDefinition || newDefinition) {
      const entryId = existingDefinition?.entryId ?? newDefinition!.entryId;

      if (!ObjectId.isValid(entryId)) {
        throw new Error("ENTRY ID INVALID");
      }

      const dict = await DictTemplate.findById(new ObjectId(entryId));

      if (!dict) {
        throw new Error("Referenced document not found");
      }

      if (newDefinition) {
        throw new Error("New definition not implemented");
      }

      ctx.dict = await this.addDictToUser(dict, ctx.journey);
      ctx.referencedDefinitionId = existingDefinition?.definitionId ?? null;

      await ctx.complete();
      return;
    }

    // Yeni döküman oluştur
    if (!aiResult.newEntry) {
      throw new Error(
        "AI did not generate a new document or reference an existing one"
      );
    }

    let implemented = false;

    if (!implemented) {
      throw new Error("New document not implemented");
    }

    const createdDict = await DictTemplate.insertOne({
      chatModel: ctx.journey.chatModel,
      language: ctx.journey.to,
      entry: {
        id: aiResult.newEntry.entryId,
        term: ctx.term,
        language: ctx.language,
        definitions: aiResult.newEntry.definitions,
      },
    });

    if (!createdDict) {
      throw new Error("Failed to insert new document");
    }

    const promises = await this.modifyDictAndCacheVector(
      ctx,
      vectorStore,
      createdDict._id
    );

    ctx.addPostGen(...promises);

    // TODO: Store the search hash & vector store
    await DictSearch.insertOne({
      hashWithAiModel: ctx.searchHash,
      dict_ID: createdDict._id,
    });

    ctx.dict = await this.addDictToUser(createdDict, ctx.journey);

    ctx.complete();

    return;
  }

  private static async modifyDictAndCacheVector(
    ctx: DictionaryCtx,
    vectorStore: VectorStore<{
      summary: string;
    }>,
    dictId: ObjectId
  ) {
    const dict = await DictTemplate.findById(dictId);
    if (!dict) {
      throw new Error("Document not found");
    }

    const modified = this._prepareDefinitions(ctx, dict.entry.definitions);

    const promises: Promise<any>[] = modified.promises;

    const updated = await DictTemplate.updateOne(
      { _id: dictId },
      {
        $set: {
          // @ts-ignore
          "entry.definitions": modified.definitions,
        },
      }
    );

    if (!updated) {
      throw new Error("Document not found");
    }

    const dictMsg = this.summarizeDict(dict).build();

    vectorStore.addEntry(ctx, dict._id, dictMsg, {
      summary: dictMsg,
    });

    return promises;
  }

  private static _prepareExplanations(
    ctx: DictionaryCtx,
    definition: BrocaTypes.Dictionary.DictionaryDefinition
  ): {
    definition: BrocaTypes.Dictionary.DictionaryDefinition;
    promises: Promise<any>[];
  } {
    const promises: Promise<any>[] = [];

    const explanations: BrocaTypes.Documentation.Explanation[] =
      definition.additional ?? [];

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
            (explanation.audioId === undefined || explanation.audioId === null)
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

    return {
      definition,
      promises,
    };
  }

  private static _prepareDefinitions(
    ctx: DictionaryCtx,
    definitions: BrocaTypes.Dictionary.DictionaryDefinition[]
  ): {
    definitions: BrocaTypes.Dictionary.DictionaryDefinition[];
    promises: Promise<any>[];
  } {
    const promises: Promise<any>[] = [];

    for (var i = 0; i < definitions.length; i++) {
      const definition = this._prepareExplanations(ctx, definitions[i]);

      promises.push(...definition.promises);

      definitions[i] = definition.definition;
    }

    return {
      definitions,
      promises,
    };
  }
}
