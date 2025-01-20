import { MaterialDetails } from "../common";

export interface ConversationCharacter {
  name: string;
  avatarPrompt: string;
  description: string;
  locale: string;
  gender: "Male" | "Female" | "Neutral";
}

export interface ConversationDetails extends MaterialDetails {
  instructions: string;
  scenarioScaffold: string;
  characters: ConversationCharacter[];
  length: number;
  voices?: {
    [key: string]: string; // char name : voice id
  };
}

export const conversationDetailsSchema = {
  type: "object",
  description:
    "The conversation material will be created later by another AI agent (#2). The main AI agent (#1) that creates the conversation material simply gives some preliminary instructions and characters to main agent(#2)." +
    "Determine a topic open to a dialogue between 2 and 5 people and characters appropriate to that topic and situation. Assign a role to the user in the instructions that is appropriate to the topic and situation. Then, the user will speak in accordance with this role and we will take this into consideration when making our evaluation." +
    "Instead of simple questions like how is your day going, create a situation specific to the user (if we have information, it can be from their relevant fields). Maybe a philosophical discussion, maybe a dialogue between drivers after a car accident, maybe a doctor-patient interview. Create a situation with creative examples and place the user there nicely. You can also create funny situations that will entertain the user.",
  properties: {
    instructions: {
      type: "string",
      example: "You are a doctor. You are talking to a patient.",
      description:
        "Instructions to the user. Will be expected that the user take on the role of the instruction.",
    },
    scenarioScaffold: {
      type: "string",
      example:
        "A conversation about the weather. The user is a weatherman. The user is talking to a reporter. Reporter uses technical jargon all the time, which is annoying. The user struggles to understand what is being said",
      description:
        "Scenario scaffolding. It will be used to generate conversation. So the scenario scaffolding will be used as part of the prompt.",
    },
    length: {
      type: "number",
      description:
        "Length of the conversation in turns. If orderly speaks A, B, $user, B it means 4 turns. It could be anywhere from 5 to 50 turns, depending on the situation, what we're trying to measure, and other factors.",
    },
    characters: {
      type: "array",
      description:
        "Characters in the conversation. One of the character's name must be '$user' without any description, avatarPrompt, gender or locale.",
      items: {
        oneOf: [
          {
            type: "object",
            properties: {
              name: { const: "$user" },
            },
            required: ["name"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              name: {
                type: "string",
                description:
                  "Name of the character. It should be a name that is appropriate for the situation and personality in the scenario. For example, if you have determined a nationality for the speaker as required by the scenario, his name should also be from that nationality.",
                examples: ["John", "Alice"],
              },
              locale: {
                type: "string",
                description:
                  "Locale of the character. It will be used to generate conversation. So the locale of the character will be used as prompt.",
                examples: [
                  "en-US",
                  "tr-TR",
                  "de-DE",
                  "fr-FR",
                  "es-ES",
                  "it-IT",
                ],
              },
              gender: {
                type: "string",
                description:
                  "Gender of the character. It will be used to generate conversation. So the gender of the character will be used as prompt.",
                enum: ["Male", "Female", "Neutral"],
                examples: ["Male", "Female", "Neutral"],
              },
              description: {
                description:
                  "Required if name is not $user. If $user not allowed. It will also used to generate conversation. So the description of the character will be used as prompt.",
                type: "string",
                examples: [
                  "John(en_US) is a 25 year old man. He is a student. He is very 'pessimistic'. He guards that 'the world is a bad place.'",
                  "Alice(en_US) is a 20 year old woman. She is a doctor. She is a mother of 2 children. She is optimistic. She is guards that 'the world is a good place.'",
                ],
              },
              avatarPrompt: {
                type: "string",
                description:
                  "Prompt for avatar generation. Required if name is not $user. If $user not allowed. It will also used to generate conversation. So the description of the character will be used as prompt.",
                examples: [
                  "John is a 25 year old man. He is a student. He is very 'pessimistic'. He guards that 'the world is a bad place.'",
                  "Alice is a 20 year old woman. She is a doctor. She is a mother of 2 children. She is optimistic. She is guards that 'the world is a good place.'",
                ],
              },
            },
            required: [
              "name",
              "description",
              "avatarPrompt",
              "gender",
              "locale",
            ],
            additionalProperties: false,
          },
        ],
      },
      minItems: 2,
      maxItems: 5,
    },
  },
  required: ["instructions", "characters", "scenarioScaffold", "length"],
  additionalProperties: false,
};
