import { ISupportedFromLocale, SupportedFromLocale } from "../models/_index";
import { WithGQLID } from "./db";

export class LocaleHelper {
  static _supportedLocales: WithGQLID<ISupportedFromLocale>[] = [];

  static async init() {
    const supportedLocales = await SupportedFromLocale.find({});
    this._supportedLocales = supportedLocales;
  }

  static getSupportedLocales() {
    return this._supportedLocales;
  }

  static getSupportedLocaleByTag(tag: string) {
    return this._supportedLocales.find((locale) => locale.tag === tag);
  }

  static getEnglishName(tag: string) {
    const locale = this.getSupportedLocaleByTag(tag);
    if (!locale) {
      throw new Error(`Locale not found: ${tag}`);
    }

    let name = locale.englishName;

    if (locale.country) {
      name = `${name} (${locale.country})`;
    }

    name = `${name} ([${locale.name} - ${locale.tag}])`;

    return name;
  }
}
