

# VoiceUp India

VoiceUp India is a citizen engagement platform for reporting, tracking, and analyzing public issues. It features geospatial problem mapping, real-time dashboards, a comment system, and an AI-powered chatbot for civic queries.

## Features

- Report problems with location, category, description, and attachments
- View and upvote/downvote problems in your area
- Comment on problems and discuss solutions
- Geospatial map with problem correlation engine
- Ministry dashboard for analytics and insights
- AI chatbot for public data and civic help
- Real-time notifications and updates

## Tech Stack

- **Frontend:** Vite, React, TypeScript, shadcn-ui, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, PostGIS, RLS, Functions)
- **Mapping:** React-Leaflet, PostGIS
- **State:** TanStack React Query

## Getting Started

### Prerequisites
- Node.js & npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Supabase project (see `supabase/config.toml` for project ID)

### Local Development

```sh
# 1. Clone the repository
git clone https://github.com/Manas-Dikshit/voiceup-india
cd voiceup-india

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

### Supabase Setup
- Ensure your Supabase project is linked in `supabase/config.toml`
- Run all migrations in `supabase/migrations/` (or use the consolidated `MANUAL_MIGRATION.sql`)
- Configure storage buckets for attachments

### Environment Variables
Create a `.env` file for any secrets (API keys, bucket names, etc). See `.env.example` if present.

## Editing & Deployment

- Edit code in your IDE and push changes to GitHub
- Deploy via your preferred static hosting (e.g., Vercel, Netlify)

## License

MIT
