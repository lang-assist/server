import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import path from "path";
import fs from "fs";
import { OpenAIModel } from "../ai/chatgpt";
import { Meta, Voices } from "../../models/_index";
import { randomString } from "../../utils/random";

export class AzureVoice {
  constructor() {}

  static async init() {
    // await this.getVoices();
  }

  //   static async getVoices() {
  //     const token = await this.getAuthToken();
  //     const response = await fetch(
  //       `https://${process.env
  //         .AZURE_SPEECH_REGION!}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
  //       {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //         },
  //       }
  //     );
  //     const data = await response.json();
  //     console.log("AZURE VOICES", data);

  //     if (!fs.existsSync(process.env.TEMP_DIR!)) {
  //       fs.mkdirSync(process.env.TEMP_DIR!, { recursive: true });
  //     }

  //     if (!fs.existsSync(path.join(process.env.TEMP_DIR!, "voices"))) {
  //       fs.mkdirSync(path.join(process.env.TEMP_DIR!, "voices"), {
  //         recursive: true,
  //       });
  //     }

  //     const langSpeakers: { [language: string]: string[] } = {};

  //     const voices: {
  //       [language: string]: {
  //         shortName: string;
  //         locale: string;
  //         secondaryLocales?: string[];
  //         styles?: string[];
  //         personalities?: string[];
  //         tailoredScenarios?: string[];
  //         gender: string;
  //       }[];
  //     } = {};

  //     for (const item of data) {
  //       const locale = item.Locale.replace("-", "_");

  //       const secondaryLocales = (
  //         item.SecondaryLocaleList as string[] | undefined
  //       )?.map((l) => l.replace("-", "_"));

  //       if (!langSpeakers[locale]) {
  //         langSpeakers[locale] = [];
  //       }
  //       langSpeakers[locale].push(item.ShortName);

  //       for (const secondaryLocale of secondaryLocales ?? []) {
  //         if (!langSpeakers[secondaryLocale]) {
  //           langSpeakers[secondaryLocale] = [];
  //         }
  //         langSpeakers[secondaryLocale].push(item.ShortName);
  //       }

  //       if (!voices[locale]) {
  //         voices[locale] = [];
  //       }

  //       voices[locale].push({
  //         shortName: item.ShortName,
  //         locale: item.Locale,
  //         secondaryLocales: secondaryLocales,
  //         styles: item.StyleList,
  //         personalities: item.VoiceTag?.VoicePersonalities,
  //         tailoredScenarios: item.VoiceTag?.TailoredScenarios,
  //         gender: item.Gender,
  //       });
  //     }

  //     let counts: {
  //       lang: string;
  //       count: number;
  //     }[] = [];

  //     for (const [locale, speakers] of Object.entries(langSpeakers)) {
  //       counts.push({
  //         lang: locale,
  //         count: speakers.length,
  //       });
  //     }

  //     counts = counts
  //       .filter((c) => c.count > 50)
  //       .sort((a, b) => b.count - a.count);

  //     fs.writeFileSync(
  //       path.join(process.env.TEMP_DIR!, "voice_counts.txt"),
  //       counts.map((c) => `${c.lang}: ${c.count}`).join("\n")
  //     );

  //     Meta.updateOne(
  //       {
  //         name: "voices",
  //       },
  //       {
  //         $set: {
  //           counts,
  //           supportedLocales: counts.map((c) => c.lang),
  //           count: counts.length,
  //         },
  //       },
  //       {
  //         upsert: true,
  //       }
  //     );

  //     const files: Set<string> = new Set();

  //     for (const [locale, items] of Object.entries(voices)) {
  //       if (items.length === 0) {
  //         continue;
  //       }

  //       if (!counts.some((c) => c.lang === locale)) {
  //         continue;
  //       }

  //       for (const item of items) {
  //         const p = path.join(
  //           process.env.TEMP_DIR!,
  //           "voices",
  //           item.shortName + ".txt"
  //         );
  //         fs.writeFileSync(
  //           p,
  //           `${item.shortName}
  // ${item.gender}
  // ${item.locale}
  // ${item.styles?.join(", ")}
  // ${item.personalities?.join(", ")}
  // ${item.tailoredScenarios?.join(", ")}
  // Secondary Locales: ${item.secondaryLocales?.join(", ")}
  //         `
  //         );
  //         await Voices.updateOne(
  //           {
  //             shortName: item.shortName,
  //           },
  //           {
  //             $set: {
  //               gender: item.gender,
  //               locale: item.locale,
  //               secondaryLocales: item.secondaryLocales,
  //               personalities: item.personalities,
  //               styles: item.styles,
  //               tailoredScenarios: item.tailoredScenarios,
  //               shortName: item.shortName,
  //             },
  //           },
  //           {
  //             upsert: true,
  //           }
  //         );

  //         files.add(p);
  //       }
  //     }

  //     // const model = new OpenAIModel("gpt-4o");

  //     // await model._init();

  //     // await model._createVoiceVectorStore(Array.from(files));

  //     // return data;
  //   }

  static voices: {
    // can be "multi-language" or language code like "en_US"
    [language: string]: {
      name: string; // ShortName
      gender: string;
      locale: string;
      secondaryLocales?: string[];
      styles?: string[];
      personalities?: string[];
      tailoredScenarios?: string[];
    }[];
  } = {};

  static async getAuthToken() {
    // Key ve region bilgilerini değişkenlere alalım
    const subscriptionKey = process.env.AZURE_SPEECH_TOKEN!;
    const region = process.env.AZURE_SPEECH_REGION!;

    try {
      // 1. Önce basit bir HTTP isteği ile test edelim
      const response = await fetch(
        `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`,
        {
          method: "POST",
          headers: {
            "Content-type": "application/x-www-form-urlencoded",
            "Content-Length": "0",
            "Ocp-Apim-Subscription-Key": subscriptionKey,
            //Authorization: `Bearer ${process.env.AZURE_SPEECH_TOKEN}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    } catch (error) {
      throw new Error("Authentication failed");
    }
  }

  static getAnalyze(json: string):
    | {
        AccuracyScore: number;
        FluencyScore: number;
        ProsodyScore: number;
        CompletenessScore: number;
        PronScore: number;
      }
    | undefined {
    let analyze: any | undefined = undefined;
    if (json) {
      try {
        analyze = JSON.parse(json);
      } catch (error) {
        console.error("AZURE SPEECH TO TEXT RESULT", error);
        return undefined;
      }
    }

    if (!analyze || !analyze.NBest || analyze.NBest.length === 0) {
      return undefined;
    }

    analyze = analyze.NBest[0].PronunciationAssessment;

    if (!analyze) {
      return undefined;
    }

    return analyze;
  }

  static async speechToText(audio: Buffer): Promise<{
    text: string;
    analyze: any;
  }> {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_TOKEN!,
      process.env.AZURE_SPEECH_REGION!
    );

    const pushStream = sdk.AudioInputStream.createPushStream();

    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

    var pronunciationAssessmentConfig = new sdk.PronunciationAssessmentConfig(
      "",
      sdk.PronunciationAssessmentGradingSystem.HundredMark,
      sdk.PronunciationAssessmentGranularity.Phoneme,
      false
    );

    pronunciationAssessmentConfig.enableProsodyAssessment = true;

    const speechRecognizer = new sdk.SpeechRecognizer(
      speechConfig,
      audioConfig
    );

    pronunciationAssessmentConfig.applyTo(speechRecognizer);

    const result = await new Promise<{
      text: string;
      analyze: any;
    } | null>((resolve, reject) => {
      speechRecognizer.recognizeOnceAsync(
        (result) => {
          switch (result.reason) {
            case sdk.ResultReason.RecognizedSpeech:
              const analyze = this.getAnalyze(result.json);

              resolve({
                text: result.text,
                analyze,
              });
              break;
            case sdk.ResultReason.Canceled:
              resolve(null);
              break;
            default:
              resolve(null);
              break;
          }
        },
        (error) => {
          reject(error);
        }
      );

      pushStream.write(audio);
      pushStream.close();
    });

    if (!result) {
      throw new Error("Failed to analyze pronunciation");
    }

    return result;
  }

  static async speak(ssml: string): Promise<Buffer> {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_TOKEN!,
      process.env.AZURE_SPEECH_REGION!
    );

    const fileName = randomString(30) + ".wav";

    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(
      path.join(process.env.TEMP_DIR!, fileName)
    );

    const speechSynthesizer = new sdk.SpeechSynthesizer(
      speechConfig,
      audioConfig
    );

    const result = await new Promise<Buffer>((resolve, reject) => {
      speechSynthesizer.speakSsmlAsync(
        ssml,
        (result) => {
          if (result.audioData) {
            resolve(Buffer.from(result.audioData));
          } else {
            console.error("SPEAK ERROR", result);
            reject(new Error(result.errorDetails));
          }
        },
        (error) => {
          reject(error);
        },
        path.join(process.env.TEMP_DIR!, fileName)
      );
    }).finally(() => {
      // delete the file
      fs.unlinkSync(path.join(process.env.TEMP_DIR!, fileName));
    });

    return result;
  }
}
