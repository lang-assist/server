# Prompt System Documentation

## Overview

This directory contains the prompt system used by BrocaAgent platform for LLM requests. The system is designed to be modular, allowing for easy maintenance and updates of different prompt components.

## Directory Structure

```
prompts/
├── parts.json         # Configuration file defining prompt parts and their combinations
├── shared/            # Shared prompt components used across multiple generators
├── generators/        # Generator-specific prompt components
├── old/               # Archived prompt components
└── README.md          # This documentation file
```

## How It Works

The prompt system uses a modular approach where:

1. Individual prompt components are stored as separate markdown files
2. The `parts.json` configuration defines which components should be combined for each type of prompt
3. The `combine.js` script in the parent directory combines these components into complete prompts

## Configuration (parts.json)

The `parts.json` file has two main sections:

### 1. Files

Maps logical component names to their file paths:

```json
"files": {
  "role": "shared/role.md",
  "platform": "shared/platform.md",
  "quiz": "generators/quiz.md",
  // ... other components
}
```

### 2. Instructions

Defines different prompt types and which components they should include:

```json
"instructions": {
  "quiz": {
    "role": "QUIZ MATERIAL GENERATOR",
    "parts": [
      "role",
      "platform",
      "base_generator",
      "difficulty",
      "quiz",
      "question",
      "question_item",
      "picture_prompt",
      "hint",
      "ssml"
    ]
  },
  // ... other instruction types
}
```

Each instruction type specifies:

- `role`: The role title that will replace the `{role}` placeholder in the prompt
- `parts`: An ordered array of component names to include in the final prompt

## Component Types

### Shared Components

Located in the `shared/` directory, these are reusable prompt parts used across multiple generators:

- `role.md`: Base role definition with `{role}` placeholder
- `platform.md`: Platform-specific information
- `base_generator.md`: Common generator instructions
- `question.md`: Question structure guidelines
- `question_item.md`: Question item structure
- `picture_prompt.md`: Guidelines for generating picture prompts
- `hint.md`: Guidelines for generating hints
- `difficulty.md`: Difficulty level definitions
- `ssml.md`: Speech Synthesis Markup Language guidelines
- `dict.md`: Dictionary-related guidelines
- `doc.md`: Documentation-related guidelines

### Generator Components

Located in the `generators/` directory, these are specific to each generator type:

- `quiz.md`: Quiz generation guidelines
- `conversation.md`: Conversation generation guidelines
- `conversation_turn.md`: Conversation turn generation guidelines
- `story.md`: Story generation guidelines
- `feedback.md`: Feedback generation guidelines
- `progress.md`: Progress report generation guidelines
- `documentation.md`: Documentation generation guidelines
- `dictionary.md`: Dictionary entry generation guidelines
- `linguistic_units.md`: Linguistic units generation guidelines

## Combining Process

The `combine.js` script in the parent directory:

1. Reads the `parts.json` configuration
2. For each instruction type, reads and combines the specified components in order
3. Replaces placeholders like `{role}` with the specified values
4. Saves the combined prompts to the `combined/` directory

## Adding New Components

To add a new prompt component:

1. Create a new markdown file in the appropriate directory (`shared/` or `generators/`)
2. Add the file reference to the `files` section in `parts.json`
3. Include the component in the relevant instruction types in the `instructions` section

## Adding New Instruction Types

To add a new instruction type:

1. Create necessary component files
2. Add them to the `files` section in `parts.json`
3. Define a new entry in the `instructions` section with the appropriate `role` and `parts` list

## Usage

To generate combined prompts, run the `combine.js` script from the parent directory:

```bash
node tools/combine.js
```

This will create or update all combined prompt files in the `combined/` directory.
