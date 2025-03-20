const fs = require("fs").promises;
const path = require("path");

const partsConfig = require("./prompts/parts.json");

/**
 * Reads a prompt part file from the specified path
 * @param {string} filePath - Path to the prompt part file
 * @returns {Promise<string>} - Content of the prompt part file
 */
async function readPromptPart(filePath) {
  try {
    const fullPath = path.join(__dirname, "prompts", filePath);
    const content = await fs.readFile(fullPath, "utf-8");
    return content.trim();
  } catch (error) {
    console.error(`Error reading prompt part ${filePath}:`, error);
    throw error;
  }
}

/**
 * Combines prompt parts based on the specified instruction type
 * @param {string} instructionType - Type of instruction to combine (e.g., 'quiz', 'conversation')
 * @returns {Promise<string>} - Combined prompt content
 */
async function combinePromptParts(instructionType) {
  try {
    if (!partsConfig.instructions[instructionType]) {
      throw new Error(`Unknown instruction type: ${instructionType}`);
    }

    const { role, parts } = partsConfig.instructions[instructionType];
    const combinedParts = [];

    let roleContent = await readPromptPart(partsConfig.files.role);

    roleContent = roleContent.replaceAll("{role}", role);

    combinedParts.push(roleContent);

    // Read and combine all specified parts
    for (const partName of parts) {
      const filePath = partsConfig.files[partName];
      if (!filePath) {
        throw new Error(`Missing file path for part: ${partName}`);
      }
      const content = await readPromptPart(filePath);
      combinedParts.push(content);
    }

    return combinedParts.join("\n\n");
  } catch (error) {
    console.error("Error combining prompt parts:", error);
    throw error;
  }
}

/**
 * Saves the combined prompt to a file
 * @param {string} instructionType - Type of instruction
 * @param {string} content - Combined prompt content
 * @returns {Promise<void>}
 */
async function savePrompt(instructionType, content) {
  try {
    const outputDir = path.join(__dirname, "combined");
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `${instructionType}.md`);
    await fs.writeFile(outputPath, content, "utf-8");
  } catch (error) {
    console.error("Error saving combined prompt:", error);
    throw error;
  }
}

/**
 * Main function to combine and save all instruction types
 */
async function combineAllInstructions() {
  try {
    const instructionTypes = Object.keys(partsConfig.instructions);

    for (const type of instructionTypes) {
      const combined = await combinePromptParts(type);
      await savePrompt(type, combined);
    }
  } catch (error) {
    console.error("Error in combine process:", error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  combineAllInstructions();
}

module.exports = {
  combinePromptParts,
  savePrompt,
  combineAllInstructions,
};

/**
 * 
 * 
 * ##### `PHONEME`

- Introduces and focuses on specific phonemes (sounds)
- Used to teach phoneme-to-spelling relationships (how a sound can be written in different ways)
- Uses International Phonetic Alphabet (IPA) notation to represent the sounds accurately
- Each PHONEME part should focus on 1-3 phonemes for targeted practice
- A stage can contain multiple PHONEME parts to build phonological awareness
- Example:
  phonems: [/k/, /s/]

The user can interact with the phonemes:

- Can ask for additional example words containing the phoneme
- Can request pronunciation guidance and tips
- Can practice minimal pairs (words differing by only the target phoneme)
- Can ask for common spelling patterns for the phoneme
- Can request clarification on phonetic notation

 */
