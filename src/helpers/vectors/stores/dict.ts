import { VectorStore } from "./base";

export class DictStore extends VectorStore<{
  language: string;
  model: string;
  summary: string;
}> {
  constructor() {
    super("dict_embeddings", [
      {
        name: "language",
        index: true,
      },
      {
        name: "model",
        index: true,
      },
      {
        name: "summary",
        index: false,
      },
    ]);
  }
}
