# STORY GENERATION

The material type used for interactive storytelling with questions. This type combines narrative progression with interactive elements to enhance comprehension and engagement.

## Story Structure

### `parts`

An array of story parts. Each part "../new/generators"contains:

`id` Unique identifier for the story part. MUST be unique in the material. DONT duplicate id. E.g part1, scene1, intro1

`type` Type of the story part. Can be 'AUDIO' for narration or character dialogue with voice, 'PICTURE' for visual scene description, 'QUESTION' for interactive question about the story.

`ssml` SSML formatted text with voice and style specifications for 'AUDIO' type.

`picturePrompt` Visual scene description for image generation for 'PICTURE' type.

`questions` Array of questions for 'QUESTION' type. Same structure as QUIZ questions.

Must reference previous story parts
Should test comprehension of the story so far

### Story Guidelines

Structure: Story progresses through small, single-sentence audio parts. Each narrative piece is presented and narrated individually. Story pauses at questions, continues after answer. Visual elements support the narrative at key moments. Minimum 15-20 sentences in total narrative. Minimum 5 questions, average 7-8 questions. Clear connection between consecutive parts. Completion time should be at least 4-5 minutes.

Content: Age and level appropriate content. Cultural sensitivity. Clear narrative progression. Engaging and educational. Each audio part should be a single, clear sentence. Progressive build-up of story elements.

Questions: Test comprehension of previous parts. Build on story context. Encourage critical thinking. Support language learning goals. Strategically placed throughout the story

### Best Practices

Narrative Flow: Break story into small, digestible audio pieces. Each audio part should be one complete sentence. Maintain logical progression. Create anticipation and engagement. Use pauses effectively with questions. Add pictures before the consecutive or long audio blocks if possible. The user can visualize the image better by seeing it while listening to the audio.

Question Integration: Strategically place questions throughout the story. Ensure they test comprehension of previous parts. Build on story context. Encourage critical thinking. Support language learning goals.

Visual and Audio Elements: Support the narrative. Add context and understanding. Enhance engagement. Reinforce learning objectives. Time visuals with relevant audio parts.

Language Focus: Target specific language skills. Include relevant vocabulary. Practice grammar structures. Support comprehension skills. Use clear, well-paced narration.

E.g

pic: A young woman with a beach bag and sunhat standing by her front door, looking excited. She's wearing a colorful summer dress and sandals.
aud: I can't wait to get to the beach! I've been waiting for this weekend forever!
aud: Come on, sis! The waves aren't going to wait for us!
aud: Just making sure I've got everything. Sunscreen, towels, snacks...
question: What items did Sarah mention she was bringing?
aud: The beach is calling! Let's go!
pic: A blue car parked in a driveway with a young man in swimming shorts and a t-shirt leaning out of the driver's window, gesturing excitedly. His sister (the woman from the previous scene) is approaching with her beach bag.
aud: Coming, coming! Oh, look at that beautiful sky!
aud: Perfect beach weather, right? Not a cloud in sight!
pic: A scenic coastal road with the ocean visible on one side. View from inside a car, showing both siblings - the brother driving and sister looking out at the view excitedly.
aud: Look at those waves! They're huge!
aud: Perfect for surfing! Did you bring your board?
question: What did Tom want to do at the beach?
...continue...

## Story Voice Guidelines

Character Dialogue: ONLY use character voices for direct speech. Each character speaks in first person. Express personality and emotions through voice styles. NO narration or descriptions in dialogue. Use SSML for voice styles (VOICE GUIDELINES)

Narrator (VERY Limited Use): Only when absolutely necessary for context. Maximum one sentence. Never describe character actions or feelings. Use SSML for voice styles (VOICE GUIDELINES)

Voice Assignments: Each character has ONE consistent voice. Use appropriate styles for emotions. Never mix character and narrator roles.

Dialogue Rules: Characters speak naturally. Use direct speech only. Show emotions through dialogue. No "said", "replied", "asked" tags. No third-person descriptions.

Story Structure: Story progresses through dialogue. Characters react to each other. Environment revealed through character observations. Actions described through character speech. Emotions conveyed through voice styles.

Remember: Let characters tell the story. Avoid narrative descriptions. Use natural dialogue. Show don't tell through speech. Keep character voices consistent.
