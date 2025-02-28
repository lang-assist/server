# Question Structure

`id`: The id of the question. MUST be unique in the material. DONT duplicate id. It will be used to identify the question in the answer. Can be 'q1', 'text1', 'q2', 'text2' etc.

`type`: Question type

`question`: Question text

In QUIZ materials, questions can also refer to a prelude: `preludeID`. `preludeID` must be the `id` of an object in the `preludes` array. (PRELUDE GUIDELINES)

### QUESTION TYPES

There are different question types. Each type's structure is as follows:

#### 1. TEXT_INPUT_WRITE

The user can freely answer the question.

#### 2. FILL_WRITE

Questions that allow the user to fill in the blanks in the question.

To indicate the blank, use expressions like `{blank1}`, `{blank2}`, `{blank3}` etc.

The `question` field must contain the sentence/phrase that needs to be filled in the sentence/phrase. "Fill in the blank" or similar expressions should not be used in the `question` field. This expression is added by the interface if the question type is known.

There can be more than one blank in a sentence. No limit.

#### 3. FILL_CHOICE

Questions that allow the user to fill in the blanks in the question by selecting from options.

`choices` field is required (QUESTION ITEM GUIDELINES)

`secondaryChoices` field is optional. In this type, question has max 2 blanks. If there is a secondary blank, `secondaryChoices` field is required.

It should only be used in blank fill questions.

The `question` field must contain the sentence/phrase that needs to be filled in the sentence/phrase. "Fill in the blank" or similar expressions should not be used in the `question` field. This expression is added by the interface if the question type is known.

To indicate the blank, use expressions like `{blank1}`, `{blank2}`, `{blank3}` etc.

#### 4. CHOICE

Used for questions with a single correct answer. Unlike FILL_CHOICE, there is no blank here. The user is expected to answer by selecting from options

`choices` field is required (QUESTION ITEM GUIDELINES)

#### 5. MULTIPLE_CHOICE

Used for questions with multiple possible answers.

Only one difference from CHOICE type: It should only be used when there are multiple answers. If there is only one answer, CHOICE type should be used.

#### 6. MATCHING

Used for questions that require matching between two lists.

`choices` (first column) and `secondaryChoices` (second column) fields are required (QUESTION ITEM GUIDELINES)

There must be clear relationships between the two lists to be matched.

#### 7. ORDERING

Used for questions that require ordering.

`choices` field is required (QUESTION CHOICE GUIDELINES)

The list content should not be added to the `question` field. `question` should only be a question. `question` field can be an empty string. If it is an empty string, an expression like "Order the elements in the list" will be added by the interface.

#### 8. TRUE_FALSE

The user can answer correctly/incorrectly.

`question` field is required.

"Is it correct?" and "Is it incorrect?" expressions should not be used. These expressions are added by the interface.

#### 9. RECORD

Used for questions that require the user to answer with their voice.

The "Answer with voice" expression should not be used in the question. This expression is added by the interface.

### QUIZ VISUALIZATION GUIDELINES

Visual materials are VERY IMPORTANT for learning process. They should be used everywhere possible

Usage Areas: Preludes (in QUIZ materials), Choices

Used in: Concrete objects, Actions, Emotions, Places, Professions, Weather, Time concepts, Basic activities

Not used in: Language rules, Abstract concepts, Complex times, Structural elements

#### Rules

- Question Item's images should not be shown in a small size, they should not contain hard details to understand.
- Picture prompts should always be in English. Prompts are not shown to the user. Only the images created with prompts are shown to the user.
- NEVER include text, numbers, clocks, time displays, or any written elements in picture prompts as these often render incorrectly.
- AVOID creating images that directly reveal the answer to questions.

## Hint Management

Before generating a question: Consider the user's level, Decide what to develop, decide what level of material to create.

After making the decision, when generating the material: Always consider what the user will see. Users can see some pre-information before the questions. In QUIZ materials, users see the preludes if any with the questions. In STORY materials, users see the images/texts if any before the questions.

### CRITICAL RULES TO AVOID TRIVIAL QUESTIONS

1. NEVER use the exact same wording in both prelude and question. This allows users to answer without language comprehension.

   - BAD: Prelude: "John wakes up at 7:00" → Question: "When does John wake up?"
   - GOOD: Prelude: "John starts his day at 7:00" → Question: "What time does John get out of bed?"

2. NEVER include direct visual answers in pictures that match text choices.

   - BAD: Picture shows a clock at 7:00 → Question asks about time with 7:00 as an option
   - GOOD: Picture shows morning activities without visible clock → Question asks about time

3. ALWAYS use different vocabulary and phrasing between prelude and questions.

   - BAD: Prelude: "Mary likes apples" → Question: "What does Mary like?"
   - GOOD: Prelude: "Mary enjoys eating fruit, especially red ones" → Question: "What is Mary's favorite fruit?"

4. ALWAYS ensure questions require actual language comprehension to answer.
   - BAD: Questions that can be answered by pattern matching or visual cues alone
   - GOOD: Questions that require understanding meaning, context, or inference

AVOID:

- Images should not be an unnecessary clue.

  - Example:
    - Question: CHOICE type question: "Which one is a cat?"
    - Purpose: To recognize animals - Beginner
    - Pre-Information: A cat picture
    - Answers: A cat picture, a dog picture etc.
    - In this case, the user can answer without developing any skills. Instead, a picture should be shown in the pre-information and the user should be asked what animal is in the picture, only with text choices.

- Questions and choices/blanks that can be answered easily without learning by matching the same expression.
  Pre-Information: "Tom wakes up at 7 AM."
  Question: "When does Tom wake up?"
  Purpose: To recognize time - Beginner
  Answers: 7 AM, 8 AM, 9 AM

  In this case, the user can answer by matching the same expression without developing any skills. Instead, the user should be asked what time Tom wakes up using different phrasing, such as "What time does Tom start his day?" or "When does Tom get out of bed?"

DO:

- Provide clues to make the question appropriate for the material difficulty level.
- Use images in pre-informations and questions to use visual memory: E.g. Enrich the pre-information with images to make it easier to understand and remember.
- Use images without direct answer clues: E.g. an image shows a cat, the user should be asked what animal is in the picture, only with text choices.
- Always use different vocabulary and phrasing between prelude text and questions.
- Ensure questions require actual language comprehension to answer correctly.

Eg 1:

Q: Select the picture of 'a cat'.

BAD
choice: picturePrompt A cat lying on windowsill with text 'cat'
When user sees the text 'cat', they can easily guess the answer.

GOOD
choice: picturePrompt A cat lying on windowsill with empty text

Eg 2:

With prelude:

"... James wakes up at 7 AM. ..."

BAD
Q: When does James wake up?
When user sees 'wakes up' they can easily guess the answer.

GOOD
Q: When does James start his day? (different words)

Eg 3:

BAD
Prelude: Picture showing a clock at 7:00 and text "John wakes up at 7:00"
Q: "What time does John wake up?"
Choices: "7:00", "8:00", "6:00"

GOOD
Prelude: Picture showing morning activities (without visible clock) and text "John starts his morning routine early"
Q: "When does John get out of bed?"
Choices: "At seven", "Before sunrise", "After breakfast"
