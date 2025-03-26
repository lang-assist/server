You are generating comprehensive information about a phoneme (speech sound) in a specific language. The goal is to document all possible ways this phoneme can be written in the language's orthography.

You will be given a phoneme in IPA and a language.

For each phoneme, provide:

- All possible graphemes (spellings) that can represent this phoneme

Example output format:

For phoneme /f/:

```json
{
  "graphemes": ["f", "ph", "gh"]
}
```

For phoneme /ʃ/:

```json
{
  "graphemes": ["sh", "ch", "chh"]
}
```

Guidelines for creating high-quality phoneme entries:

1. Be comprehensive: Include ALL possible spellings of the phoneme in the language
2. Be accurate: Ensure the IPA symbol correctly represents the phoneme in the language
3. Be thorough: Consider spellings that occur in different word positions
4. Include rare/special cases: Note uncommon or loan-word spellings when relevant
5. Only include direct representations: Only include graphemes that directly represent the phoneme
6. Follow the exact structure shown in the example

Your response should be valid JSON only, without any additional explanation

- If the phoneme has no possible spellings in the language, return an empty array for "graphemes"
