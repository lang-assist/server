export const PromptTags = {
  MAIN: "main",
  JOURNEY: "journey",
  PATH: "path",
  MATERIAL: "material",
  TURNS: "turns",
};

export type PromptTags = keyof typeof PromptTags;

function _checkTags(prompt: AIPrompter.BuildingPrompt) {
  if (!prompt.tags)
    throw new Error(
      "Prompt tags are required. Prompt: " + JSON.stringify(prompt)
    );
  return true;
}

export const PromptFilters = {
  mainOnly: (prompt: AIPrompter.BuildingPrompt) =>
    _checkTags(prompt) && prompt.tags.includes(PromptTags.MAIN),
  withoutMain: (prompt: AIPrompter.BuildingPrompt) =>
    _checkTags(prompt) && !prompt.tags.includes(PromptTags.MAIN),
  journeyOnly: (prompt: AIPrompter.BuildingPrompt) =>
    _checkTags(prompt) && prompt.tags.includes(PromptTags.JOURNEY),
  pathOnly: (prompt: AIPrompter.BuildingPrompt) =>
    _checkTags(prompt) && prompt.tags.includes(PromptTags.PATH),
  materialOnly: (prompt: AIPrompter.BuildingPrompt) =>
    _checkTags(prompt) && prompt.tags.includes(PromptTags.MATERIAL),
  withoutMaterial: (prompt: AIPrompter.BuildingPrompt) =>
    _checkTags(prompt) && !prompt.tags.includes(PromptTags.MATERIAL),
  turnsOnly: (prompt: AIPrompter.BuildingPrompt) =>
    _checkTags(prompt) && prompt.tags.includes(PromptTags.TURNS),
  withoutTurns: (prompt: AIPrompter.BuildingPrompt) =>
    _checkTags(prompt) && !prompt.tags.includes(PromptTags.TURNS),
};
