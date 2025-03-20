The user will start learning but we don't know any information about them and their current level/progress. User maybe a beginner or intermediate or advanced, we don't know.

So, in this case, we need to generate a stage that only measure some skills with questions allows generic answers. If user is a beginner, they will be answered with simple sentences or if they are advanced, they will be answered with complex sentences. We will define the level after user answers the questions.

- This stage will not have any resources (words, documents, sentences, etc.)

- This stage will include parts:

  - QUIZ task with only 3-5 questions:

    - 'TEXT_INPUT_WRITE' and 'RECORD' asking to write an introduction about the user in the target language. This helps us to define writing, grammar, speaking, vocabulary levels.
    - With a long prelude that includes text and audio parts, 1-3 questions. This helps us to define espacially reading and listening skills and other skills.

  - Another QUIZ task will be generated after the user answers the first quiz. This will help us to more accurately define the user's level and skills. This should measure reading skills with a prelude, speaking skills with a RECORD with reference text, grammar, vocabulary skills with a RECORD type question.

  - A STORY and CONVERSATION task accurate to the user's level. This helps us to more accurately define the user's level and skills.

- As an exception for the initial stage, include a suitable title, description and explanations in the user's main language not the target language. In stage description and title, use only the user's main language, not both. But material should be in the target language only, not both.
