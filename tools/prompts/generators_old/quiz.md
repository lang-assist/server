## Quiz Structure

- `preludes`: Optional pre-information. If multiple questions are grouped, this is used to indicate the context. It can also provide pre-information for a single question.
- `questions`: Array of questions (QUESTION STRUCTURE). Additionally for QUIZ materials, each question can also refer to a prelude: `preludeID`. `preludeID` must be the `id` of an object in the `preludes` array. (Quiz Prelude Guidelines)

### Quiz Prelude Guidelines

Preludes provide context for quiz questions. They can be used to set up scenarios, provide background information, or create a context for multiple questions.

#### Structure

Each prelude must have:

`id`: Unique identifier. Must be unique within material. Format: 'prelude1', 'story1', 'context1'. NO duplicates allowed

`parts`: Array of content parts

Each part "../generators"must have:

- `type`: 'TEXT' | 'PICTURE' | 'AUDIO'
- `content`: Content based on type
  - TEXT: Text. Text can be formatted with supported HTML tags. (HTML TEXT GUIDELINES)
  - PICTURE: Picture prompt. Must be according to (Picture Prompt Guidelines)
  - AUDIO: Text-to-speech content. Must be formatted following (Voice Guidelines) and (SSML Documentation). You can use only provided voices and styles. DO NOT use any other voices or styles.

#### ‼️ CRITICAL RULES FOR PRELUDE-QUESTION RELATIONSHIPS ‼️

1. NEVER use the exact same wording or phrasing in both prelude and questions. This allows users to answer without language comprehension.

   - BAD: Prelude: "John wakes up at 7:00" → Question: "When does John wake up?"
   - GOOD: Prelude: "John starts his day at 7:00" → Question: "What time does John get out of bed?"

2. NEVER include direct visual answers in pictures that match text choices.

   - BAD: Picture shows a clock at 7:00 → Question asks about time with 7:00 as an option
   - GOOD: Picture shows morning activities without visible clock → Question asks about time

3. ALWAYS use completely different vocabulary and phrasing between prelude and questions.

   - BAD: Prelude: "Mary likes apples" → Question: "What does Mary like?"
   - GOOD: Prelude: "Mary enjoys eating fruit, especially red ones" → Question: "What is Mary's favorite fruit?"

4. ALWAYS ensure questions require actual language comprehension to answer.

   - BAD: Questions that can be answered by pattern matching or visual cues alone
   - GOOD: Questions that require understanding meaning, context, or inference

5. NEVER include clocks, time displays, text elements, or numbers in picture prompts as these often render incorrectly.

6. ALL questions must be linked to appropriate preludes OR be completely self-contained.

7. NEVER create questions that directly test information not provided in the prelude.

8. For open-ended questions, include clear assessment criteria or model answers.

#### Prelude-Question Checklist (VERIFY BEFORE COMPLETION):

- Each question uses different vocabulary than its prelude
- No direct word-for-word copying between prelude and questions
- Questions require language comprehension, not pattern matching
- Pictures do not contain text, numbers, clocks, or direct answers
- Each question is properly linked to a relevant prelude or is self-contained
- Open-ended questions have clear assessment criteria
- Multiple questions from same prelude use varied question types
- True/False questions are based on information directly implied or stated in prelude

#### Usage Rules

When to Use: Multiple questions share context, Scene setting needed, Complex scenarios, Visual/audio support required.

When NOT to Use: Single simple question, Self-contained questions, No shared context needed, Would provide answer hints

#### Content Guidelines

Text Content (TEXT): Clear and concise, Level-appropriate language, Relevant to questions, Cultural sensitivity, No unnecessary details, MUST use different vocabulary than questions, MUST NOT directly reveal answers

Visual Content (PICTURE): Support understanding, Clear connection to context, Follow image guidelines strictly, Appropriate complexity, NEVER include text, numbers, clocks, or time displays, NEVER directly reveal answers to questions

Audio Content (AUDIO): Natural speech patterns, Clear pronunciation, Appropriate pace, Follow voice guidelines

#### Best Practices

Content Organization: Logical flow between parts, Progressive information reveal, Clear connections to questions, Balanced media use

Language Level: Match user's proficiency, Consistent terminology, Clear structure, Natural language

Media Integration: Purposeful use of images, Supportive audio elements, Complementary content, No redundancy

Question Connection: Clear relevance to questions, No direct answers, Supporting context, Natural references, Different vocabulary and phrasing than questions

#### Common Mistakes

AVOID: Overly complex scenarios, Irrelevant details, Answer hints in prelude, Disconnected content, Using same vocabulary in prelude and questions, Including visual elements that directly reveal answers, Creating questions that can be answered without language comprehension

DO NOT: Mix difficulty levels, Include multiple topics, Create ambiguous context, Overuse media, Include clocks, time displays, or text in images, Use exact same phrasing in prelude and questions

#### Examples of Good and Bad Prelude-Question Pairs

BAD EXAMPLE:

Prelude:

- John wakes up at 7:00 in the morning.
- A bedroom with an alarm clock showing 7:00 AM.

Question: What time does John wake up?

- Choices: 7:00, 8:00, 6:00

Why it's bad:

1. The question uses the same phrasing as the prelude ("wakes up")
2. The picture shows a clock with the exact answer
3. The user can answer without understanding language

GOOD EXAMPLE:

Prelude:

- John begins his daily routine early.
- A bedroom with early morning sunlight coming through the window.

Question: When does John get out of bed?

- Choices: Early in the morning, At noon, Late at night

Why it's good:

1. Different phrasing between prelude and question
2. Picture shows context without revealing the exact answer
3. User must understand language to answer correctly

#### Sample Quiz Structure with Varied Question Types

EXCELLENT PRELUDE:

Prelude:

- Emma frequents a neighborhood bistro whenever she needs a break.
- A cozy cafe interior with soft lighting. A woman with shoulder-length hair gazing out of a large window with a steaming cup on the table in front of her. The street outside shows people walking by.

Question1: What might Emma be drinking based on the context?

- Choices: A hot beverage, Cold water, A milkshake, Iced tea

Question2: Where does Emma prefer to sit when at the bistro?

- Choices: Near the window, At the counter, In a private booth, Outside on the patio

Question3: What does Emma do when she goes to the bistro?

- Choices: Relax, Meet friends, Work, Eat dinner

Key strengths:

1. Varied vocabulary between prelude and questions
2. Questions require understanding context, not just matching words
3. Picture provides context without revealing specific answers
4. Different question types test varied comprehension skills
5. Each question is clearly linked to the prelude
