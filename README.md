# Chat Support System

A modern chat support system built with Next.js, similar to Tidio. This application provides real-time chat functionality, user authentication, and a clean user interface for customer support interactions.

## Features

- Real-time chat using Pusher
- User authentication with Clerk
- PostgreSQL database with Prisma ORM
- Modern UI with Tailwind CSS
- Responsive design
- Message history
- Conversation management
- Role-based access (Admin, Agent, Customer)

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Clerk account for authentication
- Pusher account for real-time functionality

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://your-username:your-password@localhost:5432/chat_support_db"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Pusher
NEXT_PUBLIC_PUSHER_APP_KEY=your_pusher_app_key
NEXT_PUBLIC_PUSHER_CLUSTER=your_pusher_cluster
PUSHER_APP_ID=your_pusher_app_id
PUSHER_SECRET=your_pusher_secret
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up the database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── api/            # API routes
│   ├── components/     # React components
│   ├── dashboard/      # Dashboard pages
│   └── layout.tsx      # Root layout
├── lib/               # Utility functions
├── prisma/           # Database schema
└── public/           # Static files
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
