import fs from "fs";
import path from "path";
import { WithId } from "mongodb";
import {
  IConversationTurn,
  IJourney,
  IStage,
  IUser,
  IUserAnswer,
  Material,
  Stage,
  UserActions,
} from "../models/_index";
import { IMaterial } from "../models/_index";
import { BrocaTypes } from "../types";
import { msg, withTag } from "../utils/prompter";
import { BaseMaterialTypeHelper } from "./gen/materials/type-helpers";
import { LanguageHelper } from "./language";
import { LocaleHelper } from "./locale";

function readInstruction(file: string) {
  const filePath = path.join(__dirname, "..", "..", "tools", "combined", file);
  let fileContent = fs.readFileSync(filePath, "utf8");

  return fileContent;
}

const MaterialGenerationVersion = 3;

export const additionalInstructions = {
  initial_stage: msg(readInstruction("../additional/initial_stage.md")),
  other_stage: msg(readInstruction("../additional/other_stage.md")),
};

export const instructions = {
  conversation_turn: {
    content: msg(readInstruction("conversation_turn.md")),
    version: 1,
  },
  conversation: {
    content: msg(readInstruction("conversation.md")),
    version: MaterialGenerationVersion,
  },
  dictionary: {
    content: msg(readInstruction("dictionary.md")),
    version: 1,
  },
  documentation: {
    content: msg(readInstruction("documentation.md")),
    version: 1,
  },
  feedback: {
    content: msg(readInstruction("feedback.md")),
    version: 1,
  },
  linguistic_units: {
    content: msg(readInstruction("linguistic_units.md")),
    version: 1,
  },
  analyzer: {
    content: msg(readInstruction("analyzer.md")),
    version: 1,
  },
  stager: {
    content: msg(readInstruction("stager.md")),
    version: 1,
  },
  quiz: {
    content: msg(readInstruction("quiz.md")),
    version: MaterialGenerationVersion,
  },
  story: {
    content: msg(readInstruction("story.md")),
    version: MaterialGenerationVersion,
  },
};

export function describeMaterial(
  material: WithId<IMaterial>,
  withInstructions: boolean
) {
  const message = msg();
  message.addKv("Type", material.details.type);
  if (material.improves.length > 0) {
    message.addKv("Improves", material.improves.join(", "));
  }
  if (material.measures.length > 0) {
    message.addKv("Measures", material.measures.join(", "));
  }
  if (withInstructions && material.instructions) {
    message.addKv("Instructions", material.instructions);
  }
  const details = BaseMaterialTypeHelper.describeDetails(material.details);
  message.addKv("Details", details);
  return message;
}

export function describeAnswer(
  type: BrocaTypes.Material.MaterialType,
  answer: WithId<IUserAnswer>
) {
  const message = msg();
  message.addKv("Answer", BaseMaterialTypeHelper.describeAnswer(type, answer));
  return message;
}

export function describeMaterialAnswer(
  material: WithId<IMaterial>,
  answer: WithId<IUserAnswer>,
  withInstructions: boolean
) {
  const message = msg();
  message.addKv("Material", describeMaterial(material, withInstructions));
  message.addKv("Answer", describeAnswer(material.details.type, answer));
  return message;
}

export function summarizeStageFocus(stage: WithId<IStage>) {
  const message = msg();

  message.addKv("Description", stage.description);
  message.addKv("Skills", stage.focusSkills?.join(", ") ?? "Unknown");
  message.addKv("Areas", stage.focusAreas?.join(", ") ?? "Unknown");
  message.addKv("Topics", stage.includedTopics?.join(", ") ?? "Unknown");

  return withTag(message, "stage_focus");
}

export async function previousBehaviors(stage: WithId<IStage>) {
  const message = msg();

  const behaviors = await UserActions.find(
    {
      stage_ID: stage._id,
    },
    {
      sort: {
        createdAt: -1,
      },
    }
  );

  for (const behavior of behaviors) {
    message.add(behavior.behavior);
  }
  return message;
}

export function progressSummary(journey: WithId<IJourney>) {
  const message = msg();

  const levels = journey.progress.level;
  const levelsMsg = msg();
  for (const [key, value] of Object.entries(levels)) {
    if (value < 0) {
      levelsMsg.addKv(key, "Unknown");
    } else {
      levelsMsg.addKv(key, `${value}%`);
    }
  }

  message.add(withTag(levelsMsg, "level"));

  const observationsMsg = msg();

  observationsMsg.addKv("General", (general) => {
    const generalObservations = journey.progress.general ?? [];
    for (let i = 0; i < generalObservations.length; i++) {
      const observation = generalObservations[i];
      general.add(msg().addKv(`Index ${i}`, observation));
    }
  });

  observationsMsg.addKv("Weak Points", (weaknesses) => {
    const weakPoints = journey.progress.weakPoints ?? [];
    for (let i = 0; i < weakPoints.length; i++) {
      const weakPoint = weakPoints[i];
      weaknesses.add(msg().addKv(`Index ${i}`, weakPoint));
    }
  });

  observationsMsg.addKv("Strong Points", (strengths) => {
    const strongPoints = journey.progress.strongPoints ?? [];
    for (let i = 0; i < strongPoints.length; i++) {
      const strongPoint = strongPoints[i];
      strengths.add(msg().addKv(`Index ${i}`, strongPoint));
    }
  });

  message.add(withTag(observationsMsg, "observations"));

  return message;
}

export async function lastStagesSummaries(journey: WithId<IJourney>) {
  const message = msg();
  const lastStages = await Stage.find(
    {
      journey_ID: journey._id,
      status: {
        $in: ["GENERATED", "COMPLETED"],
      },
    },
    {
      sort: {
        createdAt: -1,
      },
      limit: 10,
    }
  );

  const count = lastStages.length;

  if (count > 0) {
    for (let i = 0; i < count; i++) {
      message.add(
        withTag(summarizeStageFocus(lastStages[i]), "stage", {
          last: (i + 1).toString(),
          name: lastStages[i].name,
        })
      );
    }
    message.add(withTag(message, "previous_stages"));
  } else {
    message.add(withTag(msg("No previous stages"), "previous_stages"));
  }

  return message;
}

export async function journeySummary(
  journey: WithId<IJourney>,
  user: WithId<IUser>
) {
  const journeySummary = msg();

  const toName = LanguageHelper.getEnglishName(journey.to);
  const fromName = LocaleHelper.getEnglishName(journey.from);

  journeySummary.add(withTag(fromName, "main-language"));
  journeySummary.add(withTag(toName, "target-language"));
  journeySummary.add(withTag(`Name: ${user.name}`, "user"));

  return journeySummary;
}

export function summarizeConversationTurn(turn: WithId<IConversationTurn>) {
  const message = msg();
  message.addKv("Turn", turn.text);
  return message;
}

function summarizeWordAnalysis(analysis: BrocaTypes.Voice.WordAnalysis) {
  const message = msg();
  message.addKv("Word", analysis.word);
  message.addKv("Accuracy", analysis.accuracy);
  message.addKv("Phonemes&Accuracies", (phonemes) => {
    for (const phoneme of analysis.phonemes) {
      phonemes.addKv(phoneme.phoneme, phoneme.accuracy);
    }
  });
  return message;
}

export function summarizePronunciationAnalysis(
  analysis: BrocaTypes.Voice.PronunciationAnalysis
) {
  const message = msg();

  message.addKv("Accuracy", analysis.accuracy);
  message.addKv("Fluency", analysis.fluency);
  message.addKv("Prosody", analysis.prosody);
  message.addKv("Completeness", analysis.completeness);
  message.addKv("Pronunciation", analysis.pronunciation);

  const sortedWords = analysis.words.sort((a, b) => b.accuracy - a.accuracy);

  // add top 5 good and bad words
  for (let i = 0; i < 5; i++) {
    if (sortedWords[i]) {
      message.add(summarizeWordAnalysis(sortedWords[i]));
    }

    if (sortedWords[sortedWords.length - 1 - i]) {
      message.add(
        summarizeWordAnalysis(sortedWords[sortedWords.length - 1 - i])
      );
    }
  }

  return message;
}
