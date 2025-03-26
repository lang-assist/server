# Question Item Structure

Question items are used in both quiz and story tasks. They define the structure of choices, and secondary choices in questions.

Used in question.choices, question.secondaryChoices arrays.

## Common Fields

Every question item must have these fields:

- `id`: Unique identifier within its context. Must be unique within the task. Format examples: 'a1', 'choice2', 'match3'. NO duplicates allowed in same array or question

- `text`: User-facing text of the item. Required for all types except when using only pictures. Must be clear and concise. Leave empty if it will be an unnecessary clue (generally using with picture or ssml will be unnecessary clues, but not always).

- `picturePrompt` (optional): Used when item needs visual representation. Must follow [Picture Prompt Guidelines]. Only use when visuals add value to learning.

If `picturePrompt` will be used, all question items in the same question should have a picture prompt.

- `ssml` (optional): Used when item needs to be pronounced. Must follow [SSML Guidelines]. Only use when pronunciation adds value to learning. Use this for pronunciation of words, graphemes, phonemes, etc. not the whole text or sentences. You can use only provided voices and styles. DO NOT use any other voices or styles.

If `ssml` will be used, all question items in the same question should have an ssml.

## Best Practices

ID Generation: Use meaningful prefixes (e.g., 'choice', 'match', 'order') Include sequential numbers Keep IDs short but descriptive

Text Content: Clear and unambiguous. Appropriate for user's level. No unnecessary context. No hints or clues to answers

Visual Usage: Only when visuals enhance learning. Follow image prompt guidelines strictly. Don't repeat information in text and image
