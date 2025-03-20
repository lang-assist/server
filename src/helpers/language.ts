import { ISupportedLanguage, SupportedLanguage } from "../models/_index";
import { WithGQLID } from "./db";

export class LanguageHelper {
  static _supportedLanguages: WithGQLID<ISupportedLanguage>[] = [];

  static async init() {
    const supportedLanguages = await SupportedLanguage.find({});
    this._supportedLanguages = supportedLanguages;
  }

  static getSupportedLanguages() {
    return this._supportedLanguages;
  }

  static getSupportedLanguageByTag(tag: string) {
    return this._supportedLanguages.find((language) => language.tag === tag);
  }

  static getEnglishName(tag: string) {
    const language = this.getSupportedLanguageByTag(tag);
    if (!language) {
      throw new Error(`Language not found: ${tag}`);
    }

    let name = language.englishName;

    if (language.country) {
      name = `${name} (${language.country})`;
    }

    name = `${name} ([${language.name} - ${language.tag}])`;

    return name;
  }
}
