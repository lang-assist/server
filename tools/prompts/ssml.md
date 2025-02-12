# SSML Documentation

We use microsoft azure as TTS service. Azure has some rules:

Single voice example:

```xml
<voice name="en-US-AvaNeural">
    This is the text that is spoken.
</voice>
```

Break example:

```xml
<voice name="en-US-AvaNeural">
    Welcome
    <break/>
    to text to speech.
    Welcome
    <break strength="medium"/>
    to text to speech.
    Welcome
    <break time="750ms"/>
    to text to speech.
</voice>
```

Break attributes:

You can use one of the attributes.

- strength: "x-weak", "weak", "medium" (default), "strong", "x-strong"
- time: "750ms" (default) or "1s" or "1500ms"

Silence example:

Use `<mstts:silence type="Sentenceboundary" value="200ms"/>` to add a silence of 200ms at between sentences.

```xml
<voice name="en-US-AvaNeural">
    <mstts:silence type="Sentenceboundary" value="200ms"/>
    If we're home schooling, the best we can do is roll with what each day brings and try to have fun along the way.
    A good place to start is by trying out the slew of educational apps that are helping children stay happy and
    smash their schooling at the same time.
</voice>

```

There are other types of silence. You can use them as needed:
"Leading" (natural),
"Leading-exact" (with exact time from the value attribute),
"Trailing" (natural),
"Trailing-exact" (with exact time from the value attribute),
"Sentenceboundary" (natural),
"Sentenceboundary-exact" (with exact time from the value attribute),
"Comma-exact" (with exact time from the value attribute),
"Semicolon-exact" (with exact time from the value attribute),
"Enumerationcomma-exact" (with exact time from the value attribute),

Specify paragraphs and sentences:

The p and s elements are used to denote paragraphs and sentences, respectively. In the absence of these elements, the
Speech service automatically determines the structure of the SSML document.

Styles & Roles:

```xml
<voice name="zh-CN-XiaomoNeural">
    <mstts:express-as style="sad" styledegree="2">
        快走吧，路上一定要注意安全，早去早回。
    </mstts:express-as>
</voice>
```

`style` attribute:

The styles in which a voice can vocalize are recorded in the voice entry in the vector store. Do not use a style other
than those. You can also change styles within a sentence, There can be different styles in different parts of the same
speech.

`styledegree` attribute:

The styledegree attribute is used to specify the degree of style change. The value ranges from 0.01 to 2. The default
value is 1. Steps are 0.01.

You can also use "Role" attribute. Roles are also includes voice entry in the vector store.

```xml
<voice name="zh-CN-XiaomoNeural">
    女儿看见父亲走了进来，问道：
    <mstts:express-as role="YoungAdultFemale" style="calm">
        “您来的挺快的，怎么过来的？”
    </mstts:express-as>
    父亲放下手提包，说：
    <mstts:express-as role="OlderAdultMale" style="calm">
        “刚打车过来的，路上还挺顺畅。”
    </mstts:express-as>
</voice>
```

- the root element `<speak>` and xml:lang attr and xml namespaces are added automatically. Your ssml content will be wrapped with <speak> tag and attributes and namespaces will be added.
