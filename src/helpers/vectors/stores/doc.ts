import { VectorStore } from "./base";

export class DocStore extends VectorStore<{
  language: string;
  model: string;
  summary: string;
}> {
  constructor() {
    super("doc_embeddings", [
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
