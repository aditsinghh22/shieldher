# ShieldHer — AI-Powered Women's Safety Platform

ShieldHer is a premium web application designed to protect women and high-risk individuals from digital harm. By leveraging advanced AI analysis, ShieldHer helps users identify manipulation, threats, and harmful patterns in chat conversations.

## ✨ Key Features

- **🛡️ AI Chat Analysis**: Upload screenshots of chat conversations (WhatsApp, Telegram, etc.) for instant analysis of manipulation, gaslighting, threats, and emotional tone.
- **📄 Certified Evidence Export**: Generate branded, timestamped PDF reports of analysis results that can be shared with lawyers, counselors, or law enforcement.
- **📥 Downloads Dashboard**: A central place to manage and re-download your generated evidence reports.
- **🌙 Global Dark Mode**: A premium, Stripe-style interface with a focus on ease of use and visual comfort, with a one-click toggle for Dark/Light mode.
- **👻 Ghost Mode (Automatic Purge)**: An optional privacy feature that automatically deletes your uploaded data and reports 24 hours after generation.

## 🚀 Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Lucide Icons
- **Styling**: Vanilla CSS (Stripe-inspired Modern Design)
- **Backend/Auth**: Supabase (Auth, PostgreSQL, Row Level Security)
- **AI Engine**: Gemini 1.5 Flash (for high-speed, accurate safety analysis)
- **PDF Engine**: jsPDF (for client-side/server-side certified reports)

## 🛠️ Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Supabase Account](https://supabase.com/)

### 2. Setup
Clone the repository and install dependencies:
```bash
npm install
```

### 3. Environment Variables
Create a `.env.local` file with your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key
SIGHTENGINE_API_USER=your_sightengine_api_user
SIGHTENGINE_API_SECRET=your_sightengine_api_secret
CRON_SECRET=your_random_string_for_ghost_purge
```

### 4. Database Schema
Ensure all required tables (`profiles`, `uploads`, `analysis_results`, `reports`) and storage buckets (`screenshots`, `reports`) are created in your Supabase project using the `supabase-schema.sql` file.

### 5. Running Localy
```bash
npm run dev
```

## 🔒 Privacy & Security
ShieldHer is built with privacy-first principles:
- **Row Level Security (RLS)**: Users can only see their own data.
- **Ghost Mode**: Optional auto-deletion for maximum plausible deniability.
- **Secure Storage**: Automated cleanup of associated files.
