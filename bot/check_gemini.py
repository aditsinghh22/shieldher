import os
from dotenv import load_dotenv

# Load key from project root's env.local (never hardcode API keys)
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_project_root, 'env.local'))
os.environ['GOOGLE_API_KEY'] = os.environ.get('GEMINI_API_KEY', '')
from langchain_google_genai import ChatGoogleGenerativeAI
llm = ChatGoogleGenerativeAI(model='gemini-2.0-flash')
print('Provider attr:', hasattr(llm, 'provider'))
print('Class bases:', [c.__name__ for c in type(llm).__mro__])
