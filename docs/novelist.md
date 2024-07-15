<→>

If you were asked to continue another author's work at an arbitrary point in the story, what information about the other author's work would you need most definitely?

</→>

<←>

To continue another author's work seamlessly and maintain consistency with their original vision, I would need the following key pieces of information:

1. The genre and target audience - This helps me understand the tone, style, and themes to incorporate in my writing.

2. The main characters, their traits, motivations, and relationships - Understanding these elements ensures that character development stays consistent and maintains emotional impact.

3. The plot or central conflict, its progression, and major turning points - Knowing the direction of the story allows me to develop new events and twists in a way that aligns with the author's intent.

4. The worldbuilding, setting, and historical context - This helps maintain consistency within the universe created by the original author.

5. The writing style, including the use of language, vocabulary, and pacing - Adopting or complementing the author's style ensures that the narrative feels familiar to readers who have followed the story up to this point.

6. The themes and underlying messages present in the original work - Embracing these elements allows me to develop ideas or plotlines that resonate with the author's intent.

7. Any significant rules, limitations, or constraints mentioned in the text - Knowing about these aspects ensures I don't stray too far from the established boundaries of the story.

8. Any known plans or future direction for the series (if applicable) - This knowledge can help guide my own writing decisions and prevent any unnecessary deviations that may disrupt the overarching narrative.

</←>

# Prompt structure

### system

Information on the text that the LLM is supposed to continue.
Optimally, this information is selected dynamically based on what the LLM needs to know at any given moment.

- A secondary LLM thread is asked to compile a list of named entities that the novelist needs more information on to continue every time the main thread halts.
- Or, as long as a named entity is mentioned in the 'user' or 'assistant' messages, information on that named entity is retrived.

### user

The most recent chunk of text from the source document.

### assistant

The LLM's continuation of the chunk of text.

<→>

What think you of this idea?

</→>

<←>

It is a very interesting concept to dynamically collect and present information that an LLM might need in order to continue the narrative. It showcases the potential for the LLM to work with real-world text as opposed to pre-defined datasets, and it adds a level of flexibility and adaptability to its storytelling capabilities.

In terms of practicality, there may be some challenges to overcome. For example, it might not always be clear which named entities an LLM will need more information on based solely on the most recent chunk of text from the source document. The secondary LLM thread would have to be designed carefully in order to work effectively in real-time with the primary LLM thread. Additionally, the retrieval system for named entity information should be robust and efficient enough to provide accurate data quickly without interrupting the flow of the narrative.

Overall, though, the idea of dynamically compiling relevant information based on a text's content shows great promise for creating more engaging and responsive narratives through LLM storytelling.

</←>
