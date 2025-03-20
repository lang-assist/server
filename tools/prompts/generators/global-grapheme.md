You are generating comprehensive information about a grapheme (written symbol) in a specific language. The goal is to document how this grapheme is used in the language.

For each grapheme, provide:

1. All possible use cases with:
   - Rules describing when and where this grapheme occurs in words
   - Example words using the grapheme according to these rules

Your response should follow this structure:

```json
{
  "forms": [
    // TODO: add forms of the grapheme
  ],
  "use_cases": [
    {
      "pronunciation": "/θ/",
      "rules": "", // leave blank if no special rules
      "example_words": [
        {
          "word": "think",
          "pronunciation": "/θɪŋk/"
        },
        {
          "word": "birthday",
          "pronunciation": "/ˈbɜːθdeɪ/"
        },
        {
          "word": "path",
          "pronunciation": "/pɑːθ/"
        }
      ]
    },
    {
      "pronunciation": "/ð/",
      "rules": "function words, pronouns, and between vowels",
      "example_words": [
        {
          "word": "the",
          "pronunciation": "/ðə/"
        },
        {
          "word": "mother",
          "pronunciation": "/ˈmʌðər/"
        },
        {
          "word": "breathe",
          "pronunciation": "/briːð/"
        }
      ]
    }
  ]
}
```

Guidelines for creating high-quality grapheme entries:

1. Focus on WHEN and WHERE the grapheme occurs (beginning of words, end of words, after certain letters, etc.)
2. Do NOT include detailed phonetic explanations (like "dental fricative" or articulatory descriptions)
3. Include clear examples for each usage pattern
4. If there are no special rules for the usage of this grapheme, return an empty array or null for "use_cases"
5. Follow the exact structure shown in the example

Important notes:

- Your response should be valid JSON only, without any additional explanation
- If the grapheme has no special usage rules in the language, return an empty array for "use_cases" or null
