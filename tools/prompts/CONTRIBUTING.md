# Contributing to the Prompt System

This guide explains how to contribute to the BrocaAgent prompt system by adding new components or modifying existing ones.

## Understanding the System

Before contributing, please read the `README.md` file to understand how the prompt system works. The system uses a modular approach where:

1. Individual prompt components are stored as separate markdown files
2. The `parts.json` configuration defines which components should be combined for each type of prompt
3. The `combine.js` script combines these components into complete prompts

## Guidelines for Writing Prompt Components

### General Guidelines

- Write clear, concise instructions
- Use markdown formatting for better readability
- Use placeholders like `{role}` for dynamic content
- Organize content with headings and lists
- Include examples where appropriate

### File Structure

Each prompt component should follow this general structure:

````markdown
## Component Title

Clear description of the component's purpose.

### Guidelines

- Guideline 1
- Guideline 2

### Examples

Example 1:

```json
{
  "example": "value"
}
```
````

Example 2:

```json
{
  "example": "value"
}
```

````

## Workflow for Adding New Components

1. **Create the Component File**:
   - Place it in the appropriate directory (`shared/` or `generators/`)
   - Follow the file structure guidelines
   - Use clear, descriptive content

2. **Update `parts.json`**:
   - Add the file reference to the `files` section
   ```json
   "files": {
     "your_component": "path/to/your_component.md",
     // ... other components
   }
````

- Include the component in relevant instruction types

```json
"instructions": {
  "some_instruction": {
    "parts": [
      // ... existing parts
      "your_component"
    ]
  }
}
```

3. **Test the Changes**:

   - Run the combine script to generate the combined prompts

   ```bash
   node tools/combine.js
   ```

   - Review the generated prompt in the `combined/` directory

4. **Document Your Changes**:
   - Update any relevant documentation

## Workflow for Modifying Existing Components

1. **Make the Changes**:

   - Edit the component file
   - Maintain the existing structure and formatting
   - Ensure your changes are compatible with all instruction types that use the component

2. **Test the Changes**:

   - Run the combine script to generate the combined prompts

   ```bash
   node tools/combine.js
   ```

   - Review the generated prompt in the `combined/` directory
   - Check all instruction types that use the modified component

3. **Document Your Changes**:
   - Update any relevant documentation

## Adding a New Instruction Type

1. **Create Necessary Component Files**:

   - Create any new components needed for the instruction type
   - Follow the guidelines for adding new components

2. **Update `parts.json`**:

   - Add any new components to the `files` section
   - Add a new entry to the `instructions` section

   ```json
   "instructions": {
     "your_instruction": {
       "role": "YOUR INSTRUCTION ROLE",
       "parts": [
         "component1",
         "component2",
         // ... other components
       ]
     }
   }
   ```

3. **Test the New Instruction Type**:

   - Run the combine script to generate the combined prompts

   ```bash
   node tools/combine.js
   ```

   - Review the generated prompt in the `combined/` directory

4. **Document the New Instruction Type**:
   - Update any relevant documentation

## Best Practices

- **Reuse Existing Components**: Before creating a new component, check if an existing one can be reused or modified
- **Maintain Consistency**: Follow the existing style and structure of prompt components
- **Test Thoroughly**: Always test your changes by generating and reviewing the combined prompts
- **Document Changes**: Keep documentation up to date with your changes

## Getting Help

If you have questions or need help with contributing to the prompt system, please contact the BrocaAgent development team.
