# WhatsApp Personal AI Agent

An AI-powered WhatsApp assistant built with Node.js, Express, MongoDB, Groq AI, and Meta WhatsApp Cloud API.

## Features

- AI-powered WhatsApp conversations using Groq AI (Llama 3.3 70B)
- Conversation history stored in MongoDB
- Knowledge base search for context-aware responses
- Human handoff support
- Lead collection and management
- Multi-user architecture
- Voice message and image support
- Admin APIs for managing chats, knowledge, and leads

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MongoDB + Mongoose
- **AI:** Groq API (Llama 3.3 70B)
- **Messaging:** Meta WhatsApp Cloud API v21.0
- **Auth:** JWT
- **Deployment:** Vercel (Serverless)

## Setup

### 1. Clone and Install

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Configure all required variables in `.env`.

### 3. MongoDB Setup

1. Create a free cluster at [MongoDB Atlas](https://mongodb.com)
2. Create a database user
3. Whitelist all IPs (0.0.0.0/0) for Vercel
4. Get your connection string and add to `.env`

### 4. Meta WhatsApp Setup

1. Go to [Meta Developer Portal](https://developers.facebook.com)
2. Create a WhatsApp app
3. Get your Access Token and Phone Number ID
4. Set a verify token of your choice
5. Configure webhook URL: `https://your-app.vercel.app/api/webhook`

### 5. Groq Setup

1. Get API key from [Groq Console](https://console.groq.com)
2. Add to `.env`

### 6. Run Locally

```bash
npm run dev
```

### 7. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Set environment variables in Vercel dashboard.

## API Endpoints

### Webhook (WhatsApp)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/webhook` | Webhook verification |
| POST | `/api/webhook` | Receive WhatsApp messages |

### Admin (Protected with JWT)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chats` | List all chats |
| GET | `/api/chat/:id` | Get chat messages |
| POST | `/api/send` | Send a WhatsApp message |
| GET | `/api/knowledge` | List knowledge base |
| POST | `/api/knowledge` | Add knowledge entry |
| GET | `/api/leads` | List leads |
| POST | `/api/human-mode` | Toggle human mode |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |

## Human Handoff

Users can request human support by saying: `human`, `agent`, `owner`, `Mian`, or `support`.

## Knowledge Base

Add FAQs, pricing info, services, and policies to the knowledge base so Aris can reference them in conversations.

## Lead Collection

Aris naturally collects leads when users express interest in services. Leads are stored with contact info and service requirements.
