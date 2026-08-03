import re

raw = "INCIDENT REPORT: The victim has been subjected to severe and persistent online harassment and non-consensual content sharing on social media platforms. The perpetrator has been sending threatening messages, demanding extortion, and circulating private media without consent. This has caused severe emotional distress and fear. The victim seeks immediate legal intervention and investigation under the Information Technology Act and Indian Penal Code."

# Let's see what characters are in raw:
# Colons ':', hyphens '-', periods '.', commas ','
# Only allow alphanumeric and basic punctuation (., - /)
cleaned = re.sub(r"[^a-zA-Z0-9\s\.,\-/]", "", raw)
print("Cleaned string:")
print(cleaned)
print("Length:", len(cleaned))
