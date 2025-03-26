Structure of prompts:

## Xml format

### Root tags:

<role>: The role of the assistant

<task>: The task instructions. No context dependent information.

<context>: The context of the task. Given by server.

<request>: The main request of the task. Given by server.

### Sub tags:

#### task tag:

Task tag includes <input> and <output> tags.

#### context tag:

Context tag includes:
<journey>: The journey of the user, target language, current language, user name, etc.
<level>: The level of the user.
<observation>: The observations inlcudes <general>, <weaknesses>, <strengths>.

If any:
<stage>: The current stage summary. Exept stage generator, this tag is required.
<previous_stage>: The previous stages summaries. Stage generator uses this.

### Global Tags:

<avoid>: Things to avoid.
<do>: Things to do.
<example>: Examples. For json examples, use <example in-yaml> tags.
