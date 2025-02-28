# Question Item Structure

Question items are used in both quiz and story materials. They define the structure of choices, and secondary choices in questions.

Used in question.choices, question.secondaryChoices arrays.

## Common Fields

Every question item must have these fields:

`id`: Unique identifier within its context. Must be unique within the material. Format examples: 'a1', 'choice2', 'match3'. NO duplicates allowed in same array or question

`text`: User-facing text of the item. Required for all types except when using only pictures. Must be clear and concise

`picturePrompt` (optional): Used when item needs visual representation. Must follow [Picture Prompt Guidelines](#picture-prompt-guidelines). Only use when visuals add value to learning

## Best Practices

ID Generation: Use meaningful prefixes (e.g., 'choice', 'match', 'order') Include sequential numbers Keep IDs short but descriptive

Text Content: Clear and unambiguous. Appropriate for user's level. No unnecessary context. No hints or clues to answers

Visual Usage: Only when visuals enhance learning. Follow image prompt guidelines strictly. Don't repeat information in text and image
