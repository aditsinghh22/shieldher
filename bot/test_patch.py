import os
from dotenv import load_dotenv
load_dotenv('shieldher/.env.local')
from langchain_openai import ChatOpenAI
from browser_use import Agent
import asyncio

ChatOpenAI.provider = property(lambda self: "openai")
llm = ChatOpenAI()
print("Monkey patch test Provider:", llm.provider)

try:
    agent = Agent(task='test', llm=llm)
    print("Agent init successful!")
except Exception as e:
    print("Failed!", str(e))
