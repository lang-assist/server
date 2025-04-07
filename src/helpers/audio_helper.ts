import { JsonL } from "../types";

export class AudioHelper {
  public static generating: {
    [key: string]: Promise<JsonL.MediaGenerationType> | undefined;
  } = {};

  static addGen(id: string, gen: Promise<JsonL.MediaGenerationType>) {
    this.generating[id] = gen;
    gen.finally(() => {
      delete this.generating[id];
    });
  }

  static getGen(id: string) {
    return this.generating[id];
  }
}
