# HTML TEXT GUIDELINES

Available tags:

Text explanation is a JSON object with "type", "text", and "ui" fields.
"type" is always "text". "text" is HTML formatted text. "ui" is the UI type like "explanation".

Supported HTML tags: `<h1>`, `<h2>`, `<h3>` for headings, `<p>` for paragraphs, `<b>`, `<strong>` for bold text, `<i>`, `<em>` for italic text, `<ul>`, `<ol>`, `<li>` for lists, `<div>` for grouping, `<span>` for inline styling, `<br>` for line breaks.

There is also a special tag for pronunciation: `<phoneme>`. It is used to pronounce the text.

Always use ipa alphabet. Only use when a phoneme or grapheme needs to be pronounced.

```xml
<phoneme alphabet="ipa" ph="k"> c </phoneme>
<phoneme alphabet="ipa" ph="k"> k </phoneme>
<phoneme alphabet="ipa" ph="ʃ"> sh </phoneme>
```

DO NOT use: `<html>`, `<head>`, `<body>` tags, Style attributes, Class or ID attributes, Script tags, External resources.
