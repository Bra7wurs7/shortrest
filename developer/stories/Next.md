# Routing
- Implement routing to allow opening files via link without reloading the app

# Agent mode
- memories
- agent has access to several tools
- If agent accesses a file using a tool, that file briefly turns animated blue while content from the file is in use in the prompt
# Left Toolbar
- Move folders to top of left sidebar column and move the upload button to the bottom
- Move directory above Clipboard
- New Entry: Agent Memories
# Center
- Available Center Tools change based on file type
## CodeMirror
- Add syntax support for .json and .yaml
- Is there any way to access and set the selection and pointer of codemirror as a signal?

# Agent Tools
The orchestrator LLM may have access to different tools depending on the state the agent is in.

---

Ask a yes/no question
- prompt_user_confirm
- prompt_user_confirm_async
- prompt_system_confirm
- prompt_system_confirm_async
- prompt_assistant_confirm
- prompt_assistant_confirm_async
Ask for a list of same-type items. An enumeration of type choices are available.
- prompt_user_list
- prompt_user_list_async
- prompt_system_list
- prompt_system_list_async
- prompt_assistant_list
- prompt_assistant_list_async
Ask to select one item from a list of choices
- prompt_user_single_choice
- prompt_user_single_choice_async
- prompt_system_single_choice
- prompt_system_single_choice_async
- prompt_assistant_single_choice
- prompt_assistant_single_choice_async
Ask to select any number of item from a list of choices
- prompt_user_multiple_choice
- prompt_user_multiple_choice_async
- prompt_system_multiple_choice
- prompt_system_multiple_choice_async
- prompt_assistant_multiple_choice
- prompt_assistant_multiple_choice_async
