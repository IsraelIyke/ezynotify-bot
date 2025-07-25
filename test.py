import difflib
import re
from datetime import datetime

# Static data for testing
old_text = """Hello look at this now. Bmf 7 added) | tv series. You have seen it right"""
new_text = """Hello look at this now. Bmf s04 (episode 7 added) | tv series. You have seen it right"""

def get_diff(old_text, new_text):
    # Split into sentences (simple version)
    def split_sentences(text):
        return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
    
    old_sentences = split_sentences(old_text)
    new_sentences = split_sentences(new_text)
    changes = []

    # Compare sentence by sentence
    for old_sent, new_sent in zip(old_sentences, new_sentences):
        if old_sent != new_sent:
            old_words = old_sent.split()
            new_words = new_sent.split()
            
            word_diff = difflib.ndiff(old_words, new_words)
            
            changed_words = []
            change_indices = []
            for i, word_line in enumerate(word_diff):
                if word_line.startswith('+ '):
                    changed_words.append(word_line[2:])
                    change_indices.append(i)
            
            if changed_words:
                # Find sentence boundaries
                all_words = new_sent.split()
                
                # Find the continuous block of changes
                first_change = min(change_indices)
                last_change = max(change_indices)
                
                # Get context within sentence boundaries
                context_start = max(0, first_change - 4)  # 2 words before
                context_end = min(len(all_words), last_change + 5)  # 2 words after
                
                context = all_words[context_start:context_end]
                
                # Bold the changed words in the context
                bolded_context = []
                for i, word in enumerate(context, start=context_start):
                    if i in change_indices:
                        bolded_context.append(f"<b>{word}</b>")
                    else:
                        bolded_context.append(word)
                
                full_context = ' '.join(bolded_context)
                
                changes.append({
                    "change": ' '.join(changed_words),
                    "action": "added",
                    "context": full_context,
                    "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })
    
    return changes

# Test the function
changes = get_diff(old_text, new_text)
for change in changes:
    print(f"Change: {change['change']}")
    print(f"Context: {change['context']}")
    print("---")