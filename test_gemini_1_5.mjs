import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
});

const API_KEY = envVars.GEMINI_API_KEY;

async function run() {
  const genAI = new GoogleGenerativeAI(API_KEY);
  
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro'];
  for (const modelName of models) {
    const model = genAI.getGenerativeModel({ model: modelName });
    try {
      const response = await model.generateContent('Reply with exactly: {"test":"ok"}');
      console.log(`${modelName} works!`, response.response.text());
    } catch (e) {
      console.error(`${modelName} failed:`, e.message);
    }
  }
}

run();
