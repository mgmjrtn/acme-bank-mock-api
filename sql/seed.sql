INSERT INTO customers (
  customer_id,
  first_name,
  last_name,
  phone,
  email,
  preferred_language,
  risk_level,
  status
) VALUES
(
  'cust_1001',
  'Mac',
  'McAlevy',
  '+16155551212',
  'mac.demo@acmebank.example',
  'en-US',
  'standard',
  'active'
),
(
  'cust_1002',
  'Jordan',
  'Rivera',
  '+16155559876',
  'jordan.rivera@acmebank.example',
  'en-US',
  'standard',
  'active'
);

INSERT INTO accounts (
  account_id,
  customer_id,
  account_type,
  display_name,
  masked_account_number,
  available_balance,
  current_balance,
  currency,
  note
) VALUES
(
  'acct_chk_1001',
  'cust_1001',
  'checking',
  'Everyday Checking',
  '****1024',
  2846.42,
  2910.12,
  'USD',
  NULL
),
(
  'acct_svg_1001',
  'cust_1001',
  'savings',
  'Acme Savings',
  '****2088',
  9180.55,
  9180.55,
  'USD',
  NULL
),
(
  'acct_cd_1001',
  'cust_1001',
  'cd',
  '12 Month Certificate',
  '****7741',
  15000.00,
  15000.00,
  'USD',
  'CD transfers require maturity review or representative support.'
),
(
  'acct_chk_1002',
  'cust_1002',
  'checking',
  'Everyday Checking',
  '****5529',
  1275.25,
  1302.25,
  'USD',
  NULL
),
(
  'acct_svg_1002',
  'cust_1002',
  'savings',
  'Acme Savings',
  '****6810',
  5420.00,
  5420.00,
  'USD',
  NULL
);

INSERT INTO transactions (
  transaction_id,
  customer_id,
  account_id,
  transaction_date,
  description,
  amount,
  account_type,
  status,
  category
) VALUES
(
  'txn_9001',
  'cust_1001',
  'acct_chk_1001',
  '2026-07-01',
  'ACME Retail',
  -46.64,
  'checking',
  'posted',
  'shopping'
),
(
  'txn_9002',
  'cust_1001',
  'acct_chk_1001',
  '2026-06-30',
  'Payroll Deposit',
  2450.00,
  'checking',
  'posted',
  'income'
),
(
  'txn_9003',
  'cust_1001',
  'acct_chk_1001',
  '2026-06-29',
  'Utility Payment',
  -138.27,
  'checking',
  'posted',
  'bills'
),
(
  'txn_9004',
  'cust_1001',
  'acct_chk_1001',
  '2026-06-28',
  'Coffee House',
  -6.82,
  'checking',
  'posted',
  'food'
),
(
  'txn_9005',
  'cust_1001',
  'acct_chk_1001',
  '2026-06-27',
  'Transfer to Savings',
  -250.00,
  'checking',
  'posted',
  'transfer'
),
(
  'txn_9101',
  'cust_1002',
  'acct_chk_1002',
  '2026-07-01',
  'Grocery Market',
  -82.15,
  'checking',
  'posted',
  'groceries'
),
(
  'txn_9102',
  'cust_1002',
  'acct_chk_1002',
  '2026-06-30',
  'Mobile Deposit',
  500.00,
  'checking',
  'posted',
  'deposit'
);

INSERT INTO customer_activity (
  customer_id,
  last_intent,
  last_action_type,
  last_action_summary,
  last_transaction_id,
  preferred_language,
  last_seen_at
) VALUES
(
  'cust_1001',
  'check_balance',
  'balance_inquiry',
  'Checked checking and savings balances',
  NULL,
  'en-US',
  NOW() - INTERVAL '2 days'
),
(
  'cust_1002',
  'recent_transactions',
  'transaction_lookup',
  'Reviewed recent checking transactions',
  NULL,
  'en-US',
  NOW() - INTERVAL '3 days'
);
