import { ObjectId, WithId } from "mongodb";
import { IVoices, Meta, Voices } from "../../../models/_index";
import { AzureHelper } from "../../ai/voice/azure";
import { VectorStore } from "./base";
import crypto from "crypto";
import { msg } from "../../../utils/prompter";
import { MessageBuilder } from "../../../utils/prompter";
import { GenerationContext } from "../../../types/ctx";
import { log } from "../../log";

class InitialVoiceCtx extends GenerationContext {
  toJSON() {
    return {
      embedded: this.embedded,
    };
  }
  constructor() {
    super("idle", "voice-embeddings");
  }
  public embedded = 0;
}

export class VoiceStore extends VectorStore<{
  gender: string;
}> {
  constructor() {
    super("voice_embeddings", [
      {
        name: "gender",
        index: true,
      },
    ]);
  }

  async _checkForUpdates(existingHash: string): Promise<void> {
    const voices = await AzureHelper.getVoices();

    const newHash = crypto
      .createHash("sha1")
      .update(JSON.stringify(voices))
      .digest("hex");

    if (existingHash !== newHash) {
      const size = 10;
      let hasMore = true;
      let promises: Promise<WithId<IVoices> | null>[] = [];

      let offset = 0;

      while (hasMore) {
        const toUpdate = voices.voices.slice(offset, offset + size);

        if (toUpdate.length === 0) {
          hasMore = false;
          break;
        }

        for (const voice of toUpdate) {
          promises.push(this.update(newHash, voice));
        }

        offset += size;
      }

      const updated = await Promise.all(promises);

      await Voices.deleteMany({
        globalHash: {
          $ne: newHash,
        },
      });

      try {
        await this.updateVectors(updated.filter((id) => id !== null));
        await Meta.updateOne(
          {
            name: "azure-voices",
          },
          {
            $set: { hash: newHash, counts: voices.counts },
          },
          {
            upsert: true,
          }
        );
      } catch (e) {
        await Voices.updateMany(
          {},
          {
            $set: {
              globalHash: existingHash,
            },
          }
        );
        console.error(e);
      }
      return;
    }
  }

  async _init(): Promise<void> {
    await super._init();

    const meta = await Meta.findOne({
      name: "azure-voices",
    });

    if (!meta) {
      await this._checkForUpdates("0");
      return;
    }

    const ids = await this._updateRequired(meta.hash);

    if (ids.length > 0) {
      await this.updateVectors(ids);
    }
  }

  async _updateRequired(hash: string) {
    const voices = await Voices.find({});

    const req: Promise<WithId<IVoices> | null>[] = [];

    for (const voice of voices) {
      req.push(
        new Promise(async (resolve) => {
          if (voice.globalHash !== hash) {
            resolve(voice);
          } else if (!(await this.exists(voice._id))) {
            resolve(voice);
          } else {
            resolve(null);
          }
        })
      );
    }

    let updateReq = await Promise.all(req);

    updateReq = updateReq.filter((v) => v !== null);

    return updateReq as WithId<IVoices>[];
  }

  static voiceInstructions(
    voice: WithId<IVoices>,
    options?: {
      withShortName?: boolean;
      withSecondaryLocales?: boolean;
      withPersonalities?: boolean;
      withStyles?: boolean;
      withTailoredScenarios?: boolean;
      overrideSingleLocale?: string;
    }
  ): MessageBuilder {
    const {
      withShortName = true,
      withSecondaryLocales = false,
      withPersonalities = false,
      withStyles = true,
      withTailoredScenarios = false,
      overrideSingleLocale,
    } = options ?? {};
    const message = msg();
    if (withShortName) {
      message.addKv("name", voice.shortName);
    }
    if (voice.gender === "Neutral") {
      message.addKv("gender", "unisex");
    } else {
      message.addKv("gender", voice.gender);
    }
    const locales = [];
    if (overrideSingleLocale) {
      locales.push(overrideSingleLocale);
    } else {
      locales.push(voice.locale.asLanguageTag());
    }
    if (withSecondaryLocales) {
      locales.push(
        ...(voice.secondaryLocales ?? []).map((l) => l.asLanguageTag())
      );
    }
    message.addKv("locales", locales.join(", "));
    if (
      withPersonalities &&
      voice.personalities &&
      voice.personalities.length > 0
    ) {
      message.addKv("personalities", voice.personalities.join(", "));
    }
    if (withStyles && voice.styles && voice.styles.length > 0) {
      message.addKv("styles", voice.styles.join(", "));
    }
    if (
      withTailoredScenarios &&
      voice.tailoredScenarios &&
      voice.tailoredScenarios.length > 0
    ) {
      message.addKv("scenarios", voice.tailoredScenarios.join(", "));
    }
    return message;
  }

  async updateVectors(voices: WithId<IVoices>[]) {
    const promises: Promise<void>[] = [];

    const ctx = new InitialVoiceCtx();

    ctx.startGeneration();

    let updated = 0;

    function incrementUpdated() {
      updated++;
      if (updated % 20 === 0) {
        log.info(`Updated ${updated} of ${voices.length}`);
      } else if (updated === voices.length) {
        log.info(`Updated ${updated} of ${voices.length}`);
      }
    }

    for (const voice of voices) {
      promises.push(this._checkAndUpdate(ctx, voice).then(incrementUpdated));
    }

    await Promise.all(promises);

    ctx.embedded = updated;

    await ctx.complete();
  }

  private async _checkAndUpdate(
    ctx: GenerationContext,
    voice: WithId<IVoices>
  ) {
    const exists = await this.exists(voice._id);

    if (!exists) {
      await this.addEntry(
        ctx,
        voice._id,
        VoiceStore.voiceInstructions(voice, {
          withTailoredScenarios: true,
          withShortName: true,
          withStyles: true,
          withSecondaryLocales: true,
          withPersonalities: true,
        }).build(),
        {
          gender: voice.gender,
        }
      );
    }

    return exists;
  }

  // returns the id of the voice if it was updated, otherwise null
  async update(
    globalHash: string,
    voice: {
      shortName: string;
      locale: string;
      secondaryLocales?: string[];
      styles?: string[];
      personalities?: string[];
      tailoredScenarios?: string[];
      gender: string;
    }
  ): Promise<WithId<IVoices> | null> {
    const voiceHash = crypto
      .createHash("sha1")
      .update(
        JSON.stringify({
          shortName: voice.shortName,
          locale: voice.locale,
          secondaryLocales: voice.secondaryLocales,
          styles: voice.styles,
          personalities: voice.personalities,
          tailoredScenarios: voice.tailoredScenarios,
          gender: voice.gender,
        })
      )
      .digest("hex");

    const existing = await Voices.findOne({
      shortName: voice.shortName,
    });

    if (!existing) {
      const newVoice = await Voices.insertOne({
        shortName: voice.shortName,
        locale: voice.locale.asLanguageTag(),
        secondaryLocales: voice.secondaryLocales?.map((l) => l.asLanguageTag()),
        styles: voice.styles,
        personalities: voice.personalities,
        tailoredScenarios: voice.tailoredScenarios,
        gender: voice.gender,
        itemHash: voiceHash,
        globalHash: globalHash,
      });

      if (!newVoice) {
        return null;
      }

      return newVoice;
    }

    const existingHash = existing.itemHash;

    if (existingHash === voiceHash) {
      if (existing.globalHash !== globalHash) {
        await Voices.findByIdAndUpdate(existing._id, {
          $set: {
            globalHash: globalHash,
          },
        });
      }

      return null;
    }

    const updated = await Voices.findByIdAndUpdate(existing._id, {
      $set: {
        itemHash: voiceHash,
        globalHash: globalHash,
      },
      $unset: {
        embedding: 1,
      },
    });

    await this.deleteEntry(this.index, existing._id);

    return updated;
  }
}
