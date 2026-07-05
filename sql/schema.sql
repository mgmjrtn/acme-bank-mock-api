DROP TABLE IF EXISTS transfer_previews;
DROP TABLE IF EXISTS otp_challenges;
DROP TABLE IF EXISTS customer_activity;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS customers;

CREATE TABLE customers (
  customer_id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  preferred_language TEXT DEFAULT 'en-US',
  risk_level TEXT DEFAULT 'standard',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE accounts (
  account_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  account_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  masked_account_number TEXT NOT NULL,
  available_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
  transaction_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(account_id) ON DELETE SET NULL,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  account_type TEXT NOT NULL,
  status TEXT DEFAULT 'posted',
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customer_activity (
  customer_id TEXT PRIMARY KEY REFERENCES customers(customer_id) ON DELETE CASCADE,
  last_intent TEXT,
  last_action_type TEXT,
  last_action_summary TEXT,
  last_transaction_id TEXT,
  preferred_language TEXT DEFAULT 'en-US',
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE otp_challenges (
  challenge_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  channel TEXT DEFAULT 'email',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transfer_previews (
  confirmation_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  from_account_id TEXT NOT NULL REFERENCES accounts(account_id),
  to_account_id TEXT NOT NULL REFERENCES accounts(account_id),
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_accounts_customer_id ON accounts(customer_id);
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX idx_otp_customer_id ON otp_challenges(customer_id);
CREATE INDEX idx_transfer_previews_customer_id ON transfer_previews(customer_id);
