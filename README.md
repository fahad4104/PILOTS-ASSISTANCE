# Pilot Assistance System ✈️

A comprehensive aviation assistance platform built with Next.js, featuring AI-powered manual search, flight plan analysis, and automated roster management with eCrew integration.

## 🌟 Features

### 1. **AI-Powered Manual Search**
- Search aviation manuals using OpenAI
- Vector store integration for fast retrieval
- Comprehensive answers with source citations

### 2. **Flight Plan Analyzer**
- Upload and analyze OFP (Operational Flight Plan) documents
- Extract key flight information
- AI-powered insights and recommendations

### 3. **Roster Management**
- View and manage flight schedules
- Monthly calendar view
- Flight statistics and analytics

### 4. **eCrew Auto Sync** 🆕
- Automatic import of flight schedules from Etihad eCrew portal
- Web scraping with Puppeteer
- Secure credential handling
- Direct integration with Supabase database

### 5. **User Management**
- Secure authentication system
- Admin approval workflow
- Role-based access control

## 🚀 Tech Stack

- **Framework**: Next.js 16.1+ (App Router)
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4
- **Web Scraping**: Puppeteer
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
- **File Storage**: Vercel Blob

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account
- OpenAI API key
- Vercel account (for deployment)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pilot-assistance
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

   # OpenAI
   OPENAI_API_KEY=your-openai-api-key

   # Admin
   ADMIN_SECRET=your-admin-secret

   # Database (if using Prisma)
   DATABASE_URL=your-database-url

   # Vercel Blob (for file storage)
   BLOB_READ_WRITE_TOKEN=your-blob-token
   ```

4. **Set up Supabase database**

   Run the SQL schema in Supabase SQL Editor:
   ```bash
   # See supabase_schema.sql for complete schema
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

## 📚 Project Structure

```
pilot-assistance/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── api/             # API routes
│   │   │   ├── ecrew/       # eCrew sync endpoints
│   │   │   ├── flights/     # Flight management
│   │   │   ├── users/       # User management
│   │   │   └── ask/         # AI manual search
│   │   ├── roster/          # Roster pages
│   │   ├── flight-plan/     # Flight plan analyzer
│   │   └── admin/           # Admin dashboard
│   ├── lib/                 # Shared utilities
│   │   ├── ecrew-scraper.ts       # eCrew web scraper
│   │   ├── puppeteer-config.ts    # Browser configuration
│   │   └── supabase.ts            # Supabase client
│   ├── components/          # React components
│   └── contexts/           # React contexts
├── prisma/                 # Prisma schema (if used)
├── public/                # Static assets
├── ECREW_SYNC_README.md   # eCrew sync documentation
├── DEPLOYMENT.md          # Deployment guide
├── USAGE_GUIDE.md         # User guide
└── test-ecrew-sync.md     # Testing guide
```

## 🔧 Configuration

### eCrew Auto Sync

The eCrew Auto Sync feature requires special configuration:

1. **Development**: Works out of the box with Puppeteer
2. **Production (Vercel)**: Requires additional setup

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

### Puppeteer Configuration

The system automatically detects the environment and configures Puppeteer:
- **Development**: Uses local Chrome/Chromium
- **Production**: Optimized for serverless environments

## 📖 Documentation

- **[eCrew Sync README](ECREW_SYNC_README.md)**: Technical details of eCrew integration
- **[Deployment Guide](DEPLOYMENT.md)**: Step-by-step deployment instructions
- **[Usage Guide](USAGE_GUIDE.md)**: End-user documentation (Arabic)
- **[Testing Guide](test-ecrew-sync.md)**: Testing procedures

## 🎯 Usage

### For Pilots

1. **Register**: Create an account and wait for admin approval
2. **Import Roster**:
   - Use Auto Sync with eCrew credentials, or
   - Upload CSV file manually
3. **View Schedule**: Browse flights by month
4. **Ask Questions**: Search aviation manuals using AI
5. **Analyze Flight Plans**: Upload and analyze OFP documents

### For Admins

1. **Login**: Access admin dashboard
2. **Approve Users**: Review and approve pending registrations
3. **Manage Manuals**: Upload aviation manuals to vector store
4. **Monitor System**: View logs and system status

## 🔐 Security

- **Credentials**: eCrew credentials are NOT stored
- **Authentication**: Secure user authentication with Supabase
- **HTTPS**: All communications encrypted
- **RLS**: Row Level Security enabled on Supabase
- **Input Validation**: All inputs validated and sanitized

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete instructions.

## 🧪 Testing

Run the test suite:

```bash
npm run test  # (if tests are set up)
```

For manual testing, see [test-ecrew-sync.md](test-ecrew-sync.md)

## 📊 Database Schema

Main tables:
- **users**: Pilot accounts and authentication
- **flights**: Flight schedule data
- **Manual**: Aviation manual metadata (if using Prisma)

See [supabase_schema.sql](supabase_schema.sql) for complete schema.

## 🐛 Troubleshooting

### Common Issues

1. **Puppeteer fails to launch**
   - Install Chrome/Chromium
   - Check `puppeteer-config.ts` settings

2. **eCrew sync fails**
   - Verify credentials
   - Check eCrew website structure
   - Review API logs

3. **Database connection errors**
   - Verify Supabase credentials
   - Check RLS policies

For more issues and solutions, see documentation files.

## 🔄 Updates and Maintenance

### Regular Tasks

- Update Puppeteer selectors if eCrew changes
- Review and update aviation manuals
- Monitor sync success rates
- Clean old flight data

### Version Updates

```bash
# Update dependencies
npm update

# Check for security issues
npm audit
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

[Specify your license here]

## 👥 Support

For issues or questions:
- Check documentation files
- Review error logs
- Contact: [Your contact information]

## 🙏 Acknowledgments

- Next.js team for the framework
- Supabase for the database
- OpenAI for AI capabilities
- Vercel for hosting
- Puppeteer team for web scraping tools

## 📈 Roadmap

- [ ] Mobile app development
- [ ] Scheduled automatic syncs
- [ ] Multi-airline support
- [ ] Advanced analytics dashboard
- [ ] Crew communication features
- [ ] Integration with other crew systems

---

Built with ❤️ for pilots by pilots
