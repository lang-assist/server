import { ObjectId, WithId } from "mongodb";
import { IVoices, Meta, Voices } from "../models/_index";
import { GenerationContext } from "../types/ctx";
import { BrocaTypes } from "../types";
import { VectorStore } from "./vectors/stores/base";
import { msg } from "../utils/prompter";

class GeneralVoiceSelectionCtx extends GenerationContext {
  toJSON() {
    return {
      status: this.status,
      voices: this.voices,
    };
  }

  public voices: ObjectId[] = [];

  public constructor(public language: string) {
    super("idle", "voice_selection");
  }
}

interface SelectedNarrators {
  id: ObjectId;
  shortName: string;
  styles: string[];
}

export class VoiceManager {
  private static _voices: {
    [key: string]: SelectedNarrators[] | undefined;
  } = {};

  private static async _selectNarrators(language: string): Promise<ObjectId[]> {
    const male = new GeneralVoiceSelectionCtx(language);
    const famale = new GeneralVoiceSelectionCtx(language);

    male.startGeneration();
    famale.startGeneration();

    const store = VectorStore.getStore("voice_embeddings");

    const maleVoicePromise = store.search(
      male,
      msg(`Speaks ${male.language} for general narration`).build(),
      {
        limit: 5,
        filter: {
          gender: "Male",
        },
      }
    );

    const femaleVoicePromise = store.search(
      famale,
      msg(`Speaks ${famale.language} for general narration`).build(),
      {
        limit: 5,
        filter: {
          gender: "Female",
        },
      }
    );

    const [maleVoice, femaleVoice] = await Promise.all([
      maleVoicePromise,
      femaleVoicePromise,
    ]);

    male.voices = maleVoice.map((v) => v.id);
    famale.voices = femaleVoice.map((v) => v.id);

    await male.complete();
    await famale.complete();

    return [...male.voices, ...famale.voices];
  }

  private static async getNarrators(
    language: string
  ): Promise<SelectedNarrators[]> {
    const meta = await Meta.findOne({
      name: `selected_narrators_${language}`,
    });

    let voiceIds: ObjectId[] = [];

    if (!meta) {
      voiceIds = await this._selectNarrators(language);
      await Meta.insertOne({
        name: `selected_narrators_${language}`,
        value: voiceIds,
      });
    } else {
      voiceIds = meta.value.map((v: any) =>
        v instanceof ObjectId ? v : new ObjectId(v as string)
      );
    }

    const voices = await Promise.all(
      voiceIds.map((voice) => Voices.findById(voice))
    );

    this._voices[language] = voices
      .filter((v) => v !== null)
      .map((v) => ({
        id: v._id,
        shortName: v.shortName,
        styles: v.styles ?? [],
      }));

    return this._voices[language];
  }

  private static _gettingNarrators: {
    [key: string]: Promise<SelectedNarrators[]> | undefined;
  } = {};

  public static async getTenVoiceFor(
    language: string
  ): Promise<SelectedNarrators[]> {
    language = language.asLanguageTag();

    if (this._voices[language]) {
      return this._voices[language]!;
    }

    if (this._gettingNarrators[language]) {
      return this._gettingNarrators[language]!;
    }

    const promise = this.getNarrators(language);

    this._gettingNarrators[language] = promise;

    promise.finally(() => {
      delete this._gettingNarrators[language];
    });

    return promise;
  }

  static async selectVoice(
    ctx: GenerationContext,
    details: BrocaTypes.Material.Conversation.ConversationDetails,
    char: BrocaTypes.Material.Conversation.ConversationCharacter
  ) {
    const vectorStore = VectorStore.getStore("voice_embeddings");

    const q = msg();

    q.addKv("Character", char.description);
    q.addKv("Locale", char.locale);
    q.addKv("Scenario", details.scenarioScaffold);

    const voices = await vectorStore.search(ctx, q.build(), {
      limit: 5,
      filter: {
        gender: char.gender,
      },
    });

    if (voices.length === 0) {
      throw new Error("No voices found");
    }

    const selectedVoice = voices[0];

    const vcs = await Voices.findById(new ObjectId(selectedVoice.id));

    if (!vcs) {
      throw new Error(
        `Voice not found: ${selectedVoice.id}: ${typeof selectedVoice.id}`
      );
    }

    return vcs;
  }
}
