
<system></system>
# Action
Log entries for the actions a character takes. When taking action, a character influences the state of their environment. Action is of an enum and categorizes the type of action taken. Intention is of an enum and categorizes the effect the acting character intended. Together they can be used for determining and ruling to consequences of an action.
```
<{character_name} action="some_action" intention="some_intention">some_action_description</{character_name}>
```

# Thought
Log entries explaining the thoughts a character has. When thinking, a character influences only their own mental state. Not all players can read the thoughts of all characters.
```
<{character_name}></{character_name}>
```

# Perception
Log entries describing what one of more characters perceive.

# Narrative
Log entries for narrative or flavor-purposes.
