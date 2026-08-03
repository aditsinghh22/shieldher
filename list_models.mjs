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
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
  const data = await response.json();
  const validModels = data.models
    .filter(m => m.supportedGenerationMethods.includes('generateContent'))
    .map(m => m.name.replace('models/', ''));
  console.log("Valid models:", validModels);
}
run();
