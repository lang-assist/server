# CONVERSATION GENERATION

The material type used for conversation practice. Your task is to create the skeleton of a conversation. In this context, you need to provide the following information:

## Conversation Structure

### `scenarioScaffold`

Conversation's scenario skeleton. Determine a topic open to a dialogue between 2 and 5 people and characters appropriate to that topic and situation. Assign a role to the user in the instructions that is appropriate to the topic and situation. Then, the user will speak in accordance with this role and we will take this into consideration when making our evaluation. Instead of simple questions like how is your day going, create a situation specific to the user (if we have information, it can be from their relevant fields). Maybe a philosophical discussion, maybe a dialogue between drivers after a car accident, maybe a doctor-patient interview. Create a situation with creative examples and place the user there nicely. You can also create funny situations that will entertain the user.

EXAMPLE: A conversation about the weather. $user is talking to a meteorologist Micheal. The meteorologist always uses technical jargon, which is annoying. The user has difficulty understanding what is being said

EXAMPLE: A conversation after a car accident between Alice and Bob's car. Alice is very angry and Bob is very sad. They are talking about the accident and how it happened. $user will try to calm the fight between them.

### `characters`

All characters in the scenario must be in this array. The information about the characters must be descriptive and clear. One of the character's name must be '$user' without any description, avatarPrompt, gender or locale.

`name`: The name of the character. Name of the character. It should be a name that is appropriate for the situation and personality in the scenario. For example, if you have determined a nationality for the speaker as required by the scenario, his name should also be from that nationality.

EXAMPLE: Nathan, Evelyn, Harper , طارق, ياسمين, سمير , 伟, 莲, 明, Ege, Lale, Umut, $user

`description`: The description of the character. It must indicate the character's role. It will also used to generate conversation. So the description of the character will be used as prompt.

"He is a student. He is very 'pessimistic'. He guards that 'the world is a bad place.'"
"She is a doctor. She is a mother of 2 children. She is optimistic. She is guards that 'the world is a good place.'"

`avatarPrompt`: Prompt for avatar generation. Required if name is not $user. If $user not allowed. It will also used to generate conversation. So the description of the character will be used as prompt. See (PICTURE PROMPT GUIDELINES)

"A 25 year old woman with blue eyes and long brown hair. She is wearing a white coat and a pair of glasses."
"A 38 year old man with blue eyes and short brown hair. He is wearing a blue shirt and a pair of glasses."

`gender`: The gender of the character. It must indicate the character's gender. 'Male', 'Female' or 'Neutral' should be used.

`locale`: The language of the character.
en-US, tr-TR, de-DE, fr-FR, es-ES, it-IT, etc

### `instructions`

Instructions given to the user to speak according to the scenario. The user's speech must follow this instruction.
"You are a patient. You are talking to a doctor. You are talking about your headache."
"You are talking with a meteorologist Micheal. Try to figure out what the weather will be like tomorrow."

### `length`

It roughly indicates how many turns the conversation will take. It should be between 5-50 turns.

### Suggestions

Create scenarios for everyday situations. You can create scenarios from every area of everyday life. Cultural awareness. Your scenarios should be small and practical.

### Character Naming

Use culturally appropriate names. General tags should not be used (e.g: 'Character A'). Use a name for the character instead of a role in the profession or context. "Reporter" instead of "John", "Doctor" instead of "Alice", "Student" instead of "Bob". The most common names in the community should not be used. Different names should also be used.

One Exception: If the topic and what is to be learned is the first encounter, "Student", "A Man" etc. can be used as descriptors.
