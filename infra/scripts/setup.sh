#!/bin/bash
# Digital HQ — Initial Setup Script

set -e

echo "=== Digital HQ Setup ==="

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Copy env files
if [ ! -f apps/backend/.env ]; then
  cp apps/backend/.env.example apps/backend/.env
  echo "Created apps/backend/.env — please fill in your Supabase credentials"
fi

if [ ! -f apps/frontend/.env.local ]; then
  cp apps/frontend/.env.example apps/frontend/.env.local
  echo "Created apps/frontend/.env.local — please fill in your Supabase credentials"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "1. Fill in Supabase credentials in apps/backend/.env"
echo "2. Fill in Supabase credentials in apps/frontend/.env.local"
echo "3. Run: pnpm dev"
echo ""
echo "Supabase setup:"
echo "  - Create a project at https://supabase.com"
echo "  - Run the migration SQL from infra/scripts/migrate.sql"
echo "  - Copy your project URL and keys into the .env files"
