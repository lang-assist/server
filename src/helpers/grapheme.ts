import { GlobalGrapheme } from "../models/_index";

export class GraphemeHelper {
  static async getGrapheme(grapheme: string, language: string) {
    let graphemeItem = await GlobalGrapheme.findOne({
      grapheme: grapheme,
      language: language,
    });

    if (!graphemeItem) {
      graphemeItem = await GlobalGrapheme.insertOne({
        grapheme: grapheme,
        language: language,
        genStatus: "CREATING",
      });
    }

    if (!graphemeItem) {
      throw new Error("Grapheme not found");
    }

    return graphemeItem;
  }
}
