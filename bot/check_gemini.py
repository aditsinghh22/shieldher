import os, sys
os.environ['GOOGLE_API_KEY'] = 'AIzaSyB5bUR_gSBfNo4l1V-HzWRkXxYZ9I-454k'
from langchain_google_genai import ChatGoogleGenerativeAI
llm = ChatGoogleGenerativeAI(model='gemini-2.0-flash')
print('Provider attr:', hasattr(llm, 'provider'))
print('Class bases:', [c.__name__ for c in type(llm).__mro__])
