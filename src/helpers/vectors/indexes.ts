export type VectorIndex =
  | "voice_embeddings"
  | "doc_embeddings"
  | "dict_embeddings";

export type VectorDbs = "redis" | "mongodb";

export type VectorStoreField = {
  index: boolean;
  name: string;
};
