export type TermType =
  | "NOUN"
  | "VERB"
  | "ADJECTIVE"
  | "ADVERB"
  | "PRONOUN"
  | "PREPOSITION"
  | "CONJUNCTION"
  | "INTERJECTION"
  | "PUNCTUATION"
  | "IDIOM"
  | "SPECIAL"
  | "BLANK"
  | "NAME"
  | "NUMBER"
  | "PHRASE"
  | "WHITESPACE"
  | "OTHER"
  | string;

export interface Term {
  expr: string;
  root?: string;
  variant?: string;
  type: TermType;
  subTerms?: Term[];
  blankLength?: number;
}

export type TermSet = Term[];

const termSchema = {
  type: "object",
  properties: {
    expr: { type: "string", description: "Expression in string format." },
    root: {
      type: "string",
      description:
        "If the expression is a word and has a root, it will be stored here. Also, if the expression is a compound term, idiom, etc. literal meaning will be stored here. Otherwise, it will be undefined.",
    },
    type: {
      type: "string",
      description:
        "Type of the term. Blank used for fill blank questions. Special used for special characters. Name used for names like John, Jane, etc.",
    },
    variant: {
      type: "string",
      description:
        "If the expression is a compound term, idiom, etc. variant will be stored here. Otherwise, it will be undefined.",
    },
    subTerms: {
      type: "array",
      items: { $ref: "#/definitions/Term" },
      description: "If the term is a compound term, it will have sub terms.",
    },
    blankLength: {
      type: "number",
      description: "If the term is a blank, it will have a length.",
    },
  },
  required: ["value", "type"],
  additionalProperties: false,
  examples: [
    {
      value: "the cat",
      type: "NOUN",
      subTerms: [
        {
          expr: "the",
          type: "PREPOSITION",
        },
        {
          expr: "cat",
          type: "NOUN",
        },
      ],
    },
    {
      value: "went",
      type: "VERB",
      root: "go",
      subTerms: [],
    },
    {
      value: "Give me a hand",
      type: "IDIOM",
      subTerms: [
        {
          value: "Give",
          type: "VERB",
        },
        {
          value: "me",
          type: "PRONOUN",
        },
        {
          value: "a",
          type: "ADJECTIVE",
        },
        {
          value: "hand",
          type: "NOUN",
        },
      ],
    },
  ],
};

const termSetSchema = {
  type: "array",
  items: { $ref: "#/definitions/Term" },
};

export const termDefinitions = {
  Term: termSchema,
  TermSet: termSetSchema,
};

export const termSetRef = {
  $ref: "#/definitions/TermSet",
};

export const termRef = {
  $ref: "#/definitions/Term",
};
