import { SupportedVoiceLocale } from "./prompts";

const languageSpecificTermTypes: Record<
  SupportedVoiceLocale | "_common",
  {
    name: string;
    description: string;
    additionalFields?: {
      name: string;
      description: string;
    }[];
  }[]
> = {
  _common: [
    {
      name: "NOUN",
      description: "Common nouns (e.g. cat, dog, house)",
      additionalFields: [
        {
          name: "noun_type",
          description: "Type of the noun (e.g. person, place, thing, etc.)",
        },
      ],
    },
    {
      name: "VERB",
      description: "Action words (e.g. run, jump, eat)",
      additionalFields: [
        {
          name: "verb_type",
          description: "Type of the verb (e.g. action, state, etc.)",
        },
      ],
    },
    {
      name: "ADJECTIVE",
      description: "Descriptive words (e.g. big, small, fast)",
      additionalFields: [
        {
          name: "adjective_type",
          description:
            "Type of the adjective (e.g. quality, quantity, degree, etc.)",
        },
      ],
    },
    {
      name: "ADVERB",
      description: "Modifiers (e.g. quickly, slowly, very)",
      additionalFields: [
        {
          name: "adverb_type",
          description:
            "Type of the adverb (e.g. degree, manner, frequency, etc.)",
        },
      ],
    },
    {
      name: "PRONOUN",
      description: "Pronouns (e.g. I, you, he, she, it, we, they)",
    },
    {
      name: "PREPOSITION",
      description: "Prepositions (e.g. in, on, at, from, by)",
      additionalFields: [
        {
          name: "preposition_type",
          description:
            "Type of the preposition (e.g. location, time, manner, etc.)",
        },
      ],
    },
    {
      name: "CONJUNCTION",
      description: "Connecting words (e.g. and, but, or)",
    },
    {
      name: "ARTICLE",
      description: "Articles (e.g. the, a, an)",
    },
    {
      name: "INTERJECTION",
      description: "Interjections (e.g. oh, wow, hi)",
    },
    {
      name: "PARTICLE",
      description: "Particles (e.g. to, in, at, from, by)",
    },
    {
      name: "SUFFIX",
      description: "Suffix (e.g. -ly, -ing, -s, -es)",
      additionalFields: [
        {
          name: "suffix_type",
          description: "Type of the suffix (e.g. -ing, plural, etc.)",
        },
      ],
    },
    {
      name: "PREFIX",
      description: "Prefix (e.g. un-, pre-, re-)",
      additionalFields: [
        {
          name: "prefix_type",
          description: "Type of the prefix (e.g. negation, prefix, etc.)",
        },
      ],
    },
    {
      name: "CONTRACTION",
      description: "Contractions (e.g. I'm, you're, he's)",
    },
    {
      name: "POSSESSIVE",
      description: "Possessive (e.g. my, your, his, her, its, our, their)",
    },
    {
      name: "WHITESPACE",
      description: "Whitespace (e.g. spaces, line breaks)",
    },
    {
      name: "PUNCTUATION",
      description: "Punctuation (e.g. ., !, ?, :, ;, ,)",
    },
    {
      name: "NUMBER",
      description:
        "Numeric values (e.g. 1, 2, 3, 4, 5, one, two, three, etc.). Use this for numbers, dates, times, weights, lengths, temperatures, and other numeric values.",
    },
    {
      name: "ORDER",
      description:
        "Order of numbers (e.g. first, second, third, 1st, 2nd, 3rd, etc.)",
    },
    {
      name: "NAME",
      description:
        "Proper nouns, names (e.g. John, Jane, Smith, Türkiye, İstanbul, etc.)",
      additionalFields: [
        {
          name: "name_type",
          description:
            "Type of the name (e.g. person, place, organization, etc.)",
        },
      ],
    },
    {
      name: "UNIT",
      description: "Units of measurement (e.g. km, kg, s, m, etc.)",
      additionalFields: [
        {
          name: "unit_type",
          description: "Type of the unit (e.g. length, weight, time, etc.)",
        },
      ],
    },
    {
      name: "IDIOM",
      description:
        "Idiomatic expressions (e.g. kick the bucket, hit the books)",
      additionalFields: [
        {
          name: "literal",
          description: "Literal meaning of the idiom",
        },
      ],
    },
    {
      name: "PROVERB",
      description: "Proverbs (e.g. a stitch in time saves nine)",
      additionalFields: [
        {
          name: "literal",
          description: "Literal meaning of the proverb",
        },
      ],
    },
    {
      name: "OTHER",
      description:
        "Other (e.g. morning, afternoon, evening, up, down and all other words that don't fit into other categories)",
    },
  ],
  en_US: [
    {
      name: "PHRASAL_VERB",
      description: "Phrasal verbs (e.g. give up, look up, etc.)",
      additionalFields: [
        {
          name: "definition",
          description: "Definition of the phrasal verb",
        },
      ],
    },
    {
      name: "COMPOUND_WORD",
      description:
        "Compound words (e.g. blackboard, playground, well-known, etc.)",
    },
    {
      name: "MODAL_VERB",
      description:
        "Modal verbs (e.g. can, could, may, might, must, should, will, would)",
    },
  ],
  tr_TR: [
    {
      name: "SUFFIX",
      description: "Suffix (Tüm ekler) (-i, -u, -a, -ne, -na, vb.)",
      additionalFields: [
        {
          name: "suffix_type",
          description:
            "sahiplik, yönelme, gecmis-zaman, vb. This names refers to the grammar rule.",
        },
      ],
    },
  ],
};

export function getTermsStructure(language: SupportedVoiceLocale) {
  const instructions: string[] = [];
  const commonTypes = languageSpecificTermTypes._common;
  const languageTypes = languageSpecificTermTypes[language] || [];

  // Merge types and their descriptions
  const mergedTypes = new Map<
    string,
    {
      name: string;
      descriptions: string[];
      additionalFields: Map<string, string[]>;
    }
  >();

  // First add common types
  commonTypes.forEach((type) => {
    mergedTypes.set(type.name, {
      name: type.name,
      descriptions: [type.description],
      additionalFields: new Map(
        type.additionalFields?.map((field) => [
          field.name,
          [field.description],
        ]) || []
      ),
    });
  });

  // Merge language specific types
  languageTypes.forEach((type) => {
    const existing = mergedTypes.get(type.name);
    if (existing) {
      // Merge with existing type
      existing.descriptions.push(type.description);
      type.additionalFields?.forEach((field) => {
        const existingField = existing.additionalFields.get(field.name) || [];
        existingField.push(field.description);
        existing.additionalFields.set(field.name, existingField);
      });
    } else {
      // Add new type
      mergedTypes.set(type.name, {
        name: type.name,
        descriptions: [type.description],
        additionalFields: new Map(
          type.additionalFields?.map((field) => [
            field.name,
            [field.description],
          ]) || []
        ),
      });
    }
  });

  instructions.push(`
TERM STRUCTURE AND USAGE:
All user-facing text must be properly structured using Terms. A Term represents a language element with the following properties:
TermSet is an array of Term. All sentences, expressions, etc. must be divided into TermSet.

Basic Structure:
- value: The actual text expression
- type: Category of the term:`);

  // Add merged types
  Array.from(mergedTypes.entries()).forEach(([name, data]) => {
    instructions.push(`  * ${name}: ${data.descriptions.join(", ")}`);
  });

  instructions.push(`- subTerms: Optional array of related Terms`);

  // Add merged additional fields
  const allFields = new Map<string, string[]>();
  mergedTypes.forEach((type) => {
    type.additionalFields.forEach((descriptions, fieldName) => {
      const existing = allFields.get(fieldName) || [];
      descriptions.forEach((desc) => {
        const typeSpecificDesc = `For ${type.name}: ${desc}`;
        existing.push(typeSpecificDesc);
      });
      allFields.set(fieldName, existing);
    });
  });

  // Add all merged fields
  allFields.forEach((descriptions, fieldName) => {
    instructions.push(
      `- ${fieldName}:\n      ${descriptions.join("\n      ")}`
    );
  });

  // Add examples based on merged structure
  instructions.push(`
Examples:
1. Simple noun: { value: "cat", type: "NOUN" }

2. Verb with type specific field: { 
     value: "running", 
     type: "VERB",
     verb_type: "action"
}

3. Idiom with literal meaning: { 
     value: "kick the bucket", 
     type: "IDIOM", 
     literal: "to die",
     subTerms: [
       { value: "kick", type: "VERB" }, 
       { value: "the", type: "ARTICLE" }, 
       { value: "bucket", type: "NOUN" }
     ]
   }`);

  if (language === "tr_TR") {
    instructions.push(`
4. Turkish suffix example: {
     value: "eve",
     type: "SUFFIX",
     suffix_type: "yonelme",
     subTerms: [
       { value: "ev", type: "NOUN" },
       { value: "e", type: "SUFFIX", suffix_type: "yonelme" }
     ]
}`);
  }

  // Add rules
  instructions.push(`
Rules:
1. EVERY user-facing string must be wrapped in a Term structure
2. TermSet is an array of Term - all sentences must be divided into TermSet
3. Complex expressions should be broken down into subTerms
4. Always specify the most specific and accurate type
5. Include type specific fields when applicable
6. Maintain consistency in term categorization
7. Don't forget to handle whitespace and punctuation as separate terms
8. Spaces between words are not included in the TermSet
9. Line breaks are included as WHITESPACE type`);

  return instructions.join("\n");
}

// const TERMS_STRUCTURE = `
// TERM STRUCTURE AND USAGE:
// All user-facing text must be properly structured using Terms. A Term represents a language element with the following properties:
// TermSet is an array of Term. All sentences, expressions, etc. must be divided into TermSet.
// - expr: The actual text expression
// - type: Category of the term:
//   * NOUN: Common nouns
//   * VERB: Action words
//   * ADJECTIVE: Descriptive words
//   * ADVERB: Modifiers
//   * PRONOUN: Pronouns
//   * PREPOSITION: Prepositions
//   * CONJUNCTION: Connecting words
//   * IDIOM: Idiomatic expressions
//   * PHRASE: Phrasal expressions
//   * NAME: Proper nouns, names
//   * NUMBER: Numeric values
//   * WHITESPACE: Line breaks
//   * PUNCTUATION: Punctuation marks
//   * SPECIAL: Articles, particles
//   * OTHER: Uncategorized terms
// - root: Optional base form of the term. For metaphors, idioms, and figurative expressions, this should contain the literal meaning
// - variant: Optional variation information (Verb1, Verb2, Verb3, -ing, plural, conjugations, declensions, etc.)
// - subTerms: Optional array of related Terms

// Examples:
// 1. Simple noun: { expr: "cat", type: "NOUN" }
// 2. Verb with root: { expr: "running", type: "VERB", root: "run" }
// 3. Idiom with literal meaning: {
//      expr: "kick the bucket",
//      type: "IDIOM",
//      root: "to die",
//      subTerms: [
//        { expr: "kick", type: "VERB" },
//        { expr: "the", type: "SPECIAL" },
//        { expr: "bucket", type: "NOUN" }
//      ]
//    }
// 4. Number: { expr: "42", type: "NUMBER" }
// 5. Name: { expr: "John", type: "NAME" }
// 6. Whitespace: { expr: "\\n", type: "WHITESPACE" }
// 7. Metaphor: {
//      expr: "time is money",
//      type: "IDIOM",
//      root: "time is valuable",
//      subTerms: [
//        { expr: "time", type: "NOUN" },
//        { expr: "is", type: "VERB" },
//        { expr: "money", type: "NOUN" }
//      ]
//    }

// Example of TermSet:

// - Sentence: "Please describe yourself briefly. You can include your name, age and profession. Let's get the ball rolling!"
// - TermSet: [
//     { expr: "Please", type: "INTERJECTION" },
//     { expr: "describe", type: "VERB" },
//     { expr: "yourself", type: "PRONOUN" },
//     { expr: "briefly", type: "ADVERB" },
//     { expr: ".", type: "PUNCTUATION" },
//     { expr: "You", type: "PRONOUN" },
//     { expr: "can", type: "VERB" },
//     { expr: "include", type: "VERB" },
//     { expr: "your", type: "PRONOUN" },
//     { expr: "name", type: "NOUN" },
//     { expr: ",", type: "PUNCTUATION" },
//     { expr: "age", type: "NOUN" },
//     { expr: ".", type: "PUNCTUATION" },
//     { expr: "and", type: "CONJUNCTION" },
//     { expr: "profession", type: "NOUN" },
//     { expr: ".", type: "PUNCTUATION" },
//     { expr: "Let's get the ball rolling!", type: "PHRASE", root: "Let's start" , subTerms: [
//       { expr: "Let's", type: "INTERJECTION" },
//       { expr: "get", type: "VERB" },
//       { expr: "the", type: "SPECIAL" },
//       { expr: "ball", type: "NOUN" },
//       { expr: "rolling", type: "VERB" },
//       { expr: "!", type: "PUNCTUATION" }
//     ]}
//   ]

// Spaces between words are not included in the TermSet. Line breaks are included as WHITESPACE.

// Rules:
// 1. EVERY user-facing string must be wrapped in a Term structure.
// 2. TermSet is an array of Term. All sentences, expressions, etc. must be divided into TermSet.
// 3. Complex expressions should be broken down into subTerms
// 4. Always specify the most specific and accurate type
// 5. Include root forms for irregular words
// 6. Use variant for conjugations, declensions, or other modifications
// 7. For idioms and metaphors, always provide the literal meaning in root
// 7. Maintain consistency in term categorization across all content
// 8. Don't forget to handle whitespace and punctuation as separate terms
// 9. Numbers and names should be properly typed as NUMBER and NAME
// `;

// const MAIN_INSTRUCTION = `You are an advanced AI language learning assistant specialized in personalized education. Your primary goal is to help users learn languages effectively through personalized content, analysis, and guidance.

// You have multiple responsibilities that you switch between based on the task specified in each request:

// 1. CONTENT GENERATION
//    When asked to generate content:
//    - Analyze user's journey, progress, and observations
//    - Create level-appropriate, engaging materials
//    - Reinforce weak points while building on strengths
//    - Introduce concepts gradually
//    - Ensure cultural appropriateness
//    - Always annotate terms for interactive learning

// 2. OBSERVATION ANALYSIS
//    When analyzing user responses:
//    - Identify mistakes and misconceptions
//    - Map learning patterns and preferences
//    - Track areas of confidence and struggle
//    - Monitor vocabulary and grammar comprehension
//    - Provide actionable insights for personalization

// 3. DICTIONARY MANAGEMENT
//    When managing the user's dictionary:
//    - Identify terms based on level and needs
//    - Create clear, contextual definitions
//    - Provide relevant examples and collocations
//    - Ensure proper term categorization
//    - Maintain progressive difficulty

// 4. GRAMMAR RULE CREATION
//    When creating grammar rules:
//    - Address specific learning needs
//    - Build upon existing knowledge
//    - Create clear explanations and examples
//    - Develop appropriate sub-rules
//    - Connect rules to practical usage

// 5. LEARNING PATH OPTIMIZATION
//    When optimizing learning paths:
//    - Analyze goals, progress, and pace
//    - Adjust content difficulty strategically
//    - Balance challenge and engagement
//    - Support long-term retention
//    - Maintain learning momentum

// ${TERMS_STRUCTURE}

// Always format your responses according to the specified response type in the request. Ensure all content is properly structured with term annotations and metadata as required.`;
