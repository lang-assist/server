import { PromptTags, Explanation } from "../utils/types";
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
} from "../models/_index";
import { MessageBuilder, msg, PromptBuilder } from "ai-prompter";
import { AIModel } from "./ai";
import { instructions } from "./prompts";
import { AIEmbeddingGenerator } from "./ai/base";
import { AudioHelper } from "./audio";
import { PictureHelper } from "./picture";

function hash(text: string, aiModel: string): string {
  return crypto.createHash("md5").update(`${text}-${aiModel}`).digest("hex");
}

export class DocumentationManager {
  private static _voiceIds: {
    [key: string]: string[];
  } = {
    en_US: [
      "677f666f6bb63e59501ad94e", // female
      "677f666f6bb63e59501ad94c", // famale
      "677f666f6bb63e59501ad94f", // male
      "677f666f6bb63e59501ad94d", // male
      "677f666f6bb63e59501ad956", // female
      "677f666f6bb63e59501ad955", // male
      "677f666f6bb63e59501ad954", // female
      "677f666f6bb63e59501ad951", // male
      "677f666f6bb63e59501ad97c", // female
      "677f666f6bb63e59501ad950", // famale
    ],
  };

  private static _voices: {
    [key: string]:
      | {
          _id: ObjectId;
          shortName: string;
          styles: string[];
        }[]
      | undefined;
  } = {};

  public static async getTenVoiceFor(language: string) {
    language = language.replace("-", "_");

    if (this._voices[language]) {
      return this._voices[language];
    }

    const voices = await Voices.find({
      _id: {
        $in: this._voiceIds[language].map((id) => new ObjectId(id)),
      },
    });

    this._voices[language] = voices.map((voice) => ({
      _id: voice._id,
      shortName: voice.shortName,
      styles: voice.styles ?? [],
    }));

    return this._voices[language];
  }

  private static _preparingDocuments: {
    [key: string]:
      | Promise<{
          doc: WithId<IUserDoc>;
        }>
      | undefined;
  } = {};

  // static async updateExistingDoc(
  //   currentDoc: WithId<IDocTemplate>,
  //   res: AIGeneratedDocumentation
  // ): Promise<number> {
  //   let lastSectionIndex = -1;
  //   if (res.additionalSection) {
  //     const update: {
  //       [key: string]: any;
  //     } = {};
  //     if (res.existingSection && res.existingSection.length > 0) {
  //       let sectionPathParts: string[] = [];

  //       let doc: {
  //         sections?: DocumentationSection[];
  //       } = currentDoc;

  //       var i = 0;
  //       for (const index of res.existingSection) {
  //         const isLast = i === res.existingSection.length - 1;

  //         sectionPathParts.push(index.toString());

  //         if (doc && doc.sections) {
  //           doc = doc.sections[index];
  //         }

  //         if (isLast) {
  //           const path = `sections.${sectionPathParts.join(".")}.sections`;
  //           if (doc.sections) {
  //             update["$push"] = {
  //               [path]: res.additionalSection,
  //             };
  //             lastSectionIndex = doc.sections.length; // pushed section's index
  //           } else {
  //             update["$set"] = {
  //               [path]: [res.additionalSection],
  //             };
  //             lastSectionIndex = 0;
  //           }
  //         }

  //         i++;
  //       }
  //     } else {
  //       // add to root
  //       if (currentDoc.sections) {
  //         update["$push"] = {
  //           sections: res.additionalSection,
  //         };
  //         lastSectionIndex = currentDoc.sections.length;
  //       } else {
  //         update["$set"] = {
  //           sections: [res.additionalSection],
  //         };
  //         lastSectionIndex = 0;
  //       }
  //     }

  //     await DocTemplate.updateOne({ _id: currentDoc._id }, { $set: update });
  //   }

  //   return lastSectionIndex;
  // }

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
  }) {
    const searchHash = hash(input.searchTerm, input.journey.aiModel);
    console.log("searchHash", searchHash);
    if (this._preparingDocuments[searchHash]) {
      return await this._preparingDocuments[searchHash];
    }

    this._preparingDocuments[searchHash] = this._findOrCreateDocumentation({
      searchHash,
      ...input,
    });

    this._preparingDocuments[searchHash]!.finally(() => {
      delete this._preparingDocuments[searchHash];
    });

    return this._preparingDocuments[searchHash];
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
    const voices = await this.getTenVoiceFor(language);

    const voicesMsg = msg("Available voices:");

    for (const voice of voices ?? []) {
      voicesMsg.addKv(
        `Voice '${voice.shortName}'`,
        msg().addKv("Styles", voice.styles.join(", "))
      );
    }

    return voicesMsg;
  }

  private static async _findOrCreateDocumentation(input: {
    searchHash: string;
    journey: WithId<IJourney>;
    title: string;
    searchTerm: string;
  }): Promise<{
    doc: WithId<IUserDoc>;
  }> {
    const journey = input.journey;
    // Önce search hash'e bakalım
    const existingDoc = await DocSearch.findOne({
      hashWithAiModel: input.searchHash,
    });

    if (existingDoc) {
      console.log("existingDoc", existingDoc);
      return {
        doc: await this.addDocToUser(existingDoc.doc_ID, journey),
      };
    }

    console.log("existingDoc not found");

    // Vector search yap
    const similarDocs = await AIEmbeddingGenerator.searchDoc({
      query: input.searchTerm,
      aiModel: journey.aiModel,
      language: journey.to,
      limit: 5,
      maxDistance: 0.6,
    }); // 5 benzer döküman, 0.8 minimum benzerlik

    const builder = new PromptBuilder();

    builder.systemMessage(instructions.documentation, {
      cache: true,
      extra: {
        tags: [PromptTags.MAIN],
      },
    });

    builder.systemMessage(instructions.ssml, {
      cache: true,
      extra: {
        tags: [PromptTags.MAIN],
      },
    });

    const voicesMsg = await this.getTenVoiceMessage(journey.to);

    builder.systemMessage(voicesMsg, {
      cache: true,
      extra: {
        tags: [PromptTags.MAIN],
      },
    });

    if (similarDocs.length > 0) {
      builder.assistantMessage((m) => {
        for (const doc of similarDocs) {
          m.addKv(`Summary of ${doc._id.toHexString()}`, doc.summary);
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
      extra: {
        tags: [PromptTags.MATERIAL],
      },
    });

    const inputMsg = msg();

    inputMsg.addKv("Language", msg(`\`\`\`${input.journey.to}\`\`\``));
    inputMsg.addKv("Title", msg(`\`\`\`${input.title}\`\`\``));
    inputMsg.addKv("Search term", msg(`\`\`\`${input.searchTerm}\`\`\``));

    builder.userMessage(inputMsg, {
      cache: false,
      extra: {
        tags: [PromptTags.MATERIAL],
      },
    });

    // AI'dan döküman oluşturmasını veya referans vermesini iste
    const aiResult = await AIModel.generateDocumentation(builder, journey);

    // Eğer var olan bir dökümanı referans verdiyse
    if (
      aiResult.existingDoc &&
      aiResult.existingDoc !== null &&
      aiResult.existingDoc !== "null" &&
      aiResult.existingDoc !== "undefined"
    ) {
      if (!ObjectId.isValid(aiResult.existingDoc)) {
        throw new Error("DOC ID INVALID");
      }

      const doc = await DocTemplate.findById(
        new ObjectId(aiResult.existingDoc)
      );

      if (!doc) {
        throw new Error("Referenced document not found");
      }

      return {
        doc: await this.addDocToUser(doc, journey),
      };
    }

    // Yeni döküman oluştur
    if (!aiResult.newDoc) {
      throw new Error(
        "AI did not generate a new document or reference an existing one"
      );
    }

    const createdDoc = await DocTemplate.insertOne({
      aiModel: journey.aiModel,
      language: journey.to,
      ...aiResult.newDoc,
    });

    if (!createdDoc) {
      throw new Error("Failed to insert new document");
    }

    this.modifyDocAndCacheVector(createdDoc._id, journey);

    // TODO: Store the search hash & vector store
    await DocSearch.insertOne({
      hashWithAiModel: input.searchHash,
      doc_ID: createdDoc._id,
    });

    return {
      doc: await this.addDocToUser(createdDoc, journey),
    };
  }

  private static async modifyDocAndCacheVector(
    docId: ObjectId,
    journey: WithId<IJourney>
  ) {
    const doc = await DocTemplate.findById(docId);
    if (!doc) {
      throw new Error("Document not found");
    }

    const modified = this._recursiveUpdate(
      {
        explanations: doc.explanations,
      },
      journey
    );

    const updated = await DocTemplate.updateOne(
      { _id: docId },
      { $set: { explanations: modified.explanations } }
    );

    if (!updated) {
      throw new Error("Document not found");
    }

    const docMsg = this.summarizeDoc(updated);

    await AIEmbeddingGenerator.cacheDocVector({
      aiModel: journey.aiModel,
      language: journey.to,
      id: doc._id,
      summary: docMsg.build(),
    });

    return doc;
  }

  private static _recursiveUpdate(
    input: {
      explanations: Explanation[];
    },
    journey: WithId<IJourney>
  ): any {
    const explanations = input.explanations;

    if (explanations) {
      for (var i = 0; i < explanations.length; i++) {
        const explanation = explanations[i];

        if (
          explanation.ssml &&
          (explanation.audioId === undefined || explanation.audioId === null)
        ) {
          const id = new ObjectId();
          AudioHelper.speak(explanation.ssml, journey.to, id);
          explanation.audioId = id.toHexString();
        }

        if (
          explanation.picturePrompt &&
          (explanation.pictureId === undefined ||
            explanation.pictureId === null)
        ) {
          const id = new ObjectId();
          PictureHelper.generateItemPicture({
            itemId: id,
            prompt: explanation.picturePrompt,
          });
          explanation.pictureId = id.toHexString();
        }

        explanations[i] = explanation;
      }
    }

    return {
      explanations,
    };
  }
}
