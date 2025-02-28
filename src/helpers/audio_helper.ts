import { BrocaTypes } from "../types";

export class AudioHelper {
  public static generating: {
    [key: string]: Promise<BrocaTypes.AI.MediaGenerationType> | undefined;
  } = {};

  static addGen(id: string, gen: Promise<BrocaTypes.AI.MediaGenerationType>) {
    this.generating[id] = gen;
    gen.finally(() => {
      delete this.generating[id];
    });
  }

  static getGen(id: string) {
    return this.generating[id];
  }
}
