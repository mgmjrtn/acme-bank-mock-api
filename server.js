const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { query } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const DEMO_OTP = process.env.DEMO_OTP || "246810";

app.use(cors());
app.use(express.json());

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\p{L}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nameMatchKey(value) {
  return normalizeName(value).toLowerCase();
}

function normalizeEmail(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[,"']/g, "")
    .replace(/\s+at\s+/g, "@")
    .replace(/\s+dot\s+/g, ".")
    .replace(/\s+underscore\s+/g, "_")
    .replace(/\s+dash\s+/g, "-")
    .replace(/\s+hyphen\s+/g, "-")
    .replace(/\s+/g, "")
    .replace(/[.]+$/, "");
}

function normalizePhone(value) {
  const raw = String(value || "").trim();
  const hasLeadingPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");

  if (!digits) return "";

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (hasLeadingPlus) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

function normalizeAccountType(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .trim();
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!name || !domain) return "masked@email";
  return `${name[0]}***@${domain}`;
}

function maskPhone(phone) {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\D/g, "");

  if (digits.length >= 10) {
    const last4 = digits.slice(-4);
    const country =
      digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : "";
    return `${country}***-***-${last4}`;
  }

  return "***-***";
}

function formatCurrency(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(Number(value || 0));
}

function publicCustomer(row) {
  return {
    customerId: row.customer_id,
    firstName: row.first_name,
    lastName: row.last_name,
    maskedEmail: maskEmail(row.email),
    maskedPhone: maskPhone(row.phone),
    preferredLanguage: row.preferred_language,
    riskLevel: row.risk_level,
    status: row.status
  };
}

function publicAccount(row) {
  return {
    accountId: row.account_id,
    type: row.account_type,
    displayName: row.display_name,
    maskedAccountNumber: row.masked_account_number,
    availableBalance: Number(row.available_balance),
    currentBalance: Number(row.current_balance),
    currency: row.currency,
    note: row.note
  };
}

function publicTransaction(row) {
  return {
    transactionId: row.transaction_id,
    date: row.transaction_date,
    description: row.description,
    amount: Number(row.amount),
    accountType: row.account_type,
    status: row.status,
    category: row.category
  };
}

async function getCustomerById(customerId) {
  const result = await query(
    "SELECT * FROM customers WHERE customer_id = $1",
    [customerId]
  );

  return result.rows[0] || null;
}

async function getAccountByType(customerId, accountType) {
  const result = await query(
    `
    SELECT *
    FROM accounts
    WHERE customer_id = $1
      AND LOWER(account_type) = LOWER($2)
    `,
    [customerId, normalizeAccountType(accountType)]
  );

  return result.rows[0] || null;
}

async function upsertActivity({
  customerId,
  lastIntent,
  lastActionType,
  lastActionSummary,
  lastTransactionId = null,
  preferredLanguage = "en-US"
}) {
  await query(
    `
    INSERT INTO customer_activity (
      customer_id,
      last_intent,
      last_action_type,
      last_action_summary,
      last_transaction_id,
      preferred_language,
      last_seen_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    ON CONFLICT (customer_id)
    DO UPDATE SET
      last_intent = EXCLUDED.last_intent,
      last_action_type = EXCLUDED.last_action_type,
      last_action_summary = EXCLUDED.last_action_summary,
      last_transaction_id = EXCLUDED.last_transaction_id,
      preferred_language = EXCLUDED.preferred_language,
      last_seen_at = NOW(),
      updated_at = NOW()
    `,
    [
      customerId,
      lastIntent,
      lastActionType,
      lastActionSummary,
      lastTransactionId,
      preferredLanguage
    ]
  );
}

app.get("/", (req, res) => {
  res.json({
    service: "Acme Bank Mock API",
    status: "ok",
    message: "Mock banking API for Cognigy Partner Enablement Lab.",
    designNote:
      "Read-only endpoints do not overwrite customer_activity. Only meaningful customer actions such as transfer confirmation and support escalation update persisted activity.",
    endpoints: [
      "GET /health",
      "POST /idv/verify",
      "POST /auth/start",
      "POST /auth/verify",
      "GET /customers/:customerId/profile",
      "GET /customers/:customerId/activity",
      "GET /customers/:customerId/accounts",
      "GET /customers/:customerId/transactions",
      "POST /transfers/preview",
      "POST /transfers/confirm",
      "POST /support/escalate"
    ]
  });
});

app.get("/health", async (req, res) => {
  try {
    const dbResult = await query("SELECT NOW() AS now");

    res.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
      databaseTime: dbResult.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      database: "unavailable",
      message: error.message
    });
  }
});

app.post("/idv/verify", async (req, res) => {
  try {
    const { lastName, phone, email } = req.body || {};

    const result = await query(
      "SELECT * FROM customers WHERE status = 'active'"
    );

    const customer = result.rows.find((row) => {
      return (
        nameMatchKey(row.last_name) === nameMatchKey(lastName) &&
        normalizePhone(row.phone) === normalizePhone(phone) &&
        normalizeEmail(row.email) === normalizeEmail(email)
      );
    });

    if (!customer) {
      return res.status(401).json({
        verified: false,
        reason: "identity_not_matched",
        message: "The customer details did not match a demo customer profile."
      });
    }

    return res.json({
      verified: true,
      customer: publicCustomer(customer),
      message:
        "Identity matched. Step-up verification may be required for protected actions."
    });
  } catch (error) {
    console.error("IDV verification error", error);

    res.status(500).json({
      verified: false,
      reason: "server_error",
      message: "The ID verification service is temporarily unavailable."
    });
  }
});

app.post("/auth/start", async (req, res) => {
  try {
    const { customerId } = req.body || {};
    const customer = await getCustomerById(customerId);

    if (!customer) {
      return res.status(404).json({
        status: "not_found",
        message: "Customer not found."
      });
    }

    const challengeId = crypto.randomUUID();

    await query(
      `
      INSERT INTO otp_challenges (
        challenge_id,
        customer_id,
        code,
        channel,
        expires_at
      )
      VALUES ($1, $2, $3, 'email', NOW() + INTERVAL '10 minutes')
      `,
      [challengeId, customerId, DEMO_OTP]
    );

    return res.json({
      status: "otp_sent",
      channel: "email",
      challengeId,
      maskedEmail: maskEmail(customer.email),
      demoCode: DEMO_OTP,
      message: `Demo email verification code sent to ${maskEmail(
        customer.email
      )}. Use ${DEMO_OTP} for this demo.`
    });
  } catch (error) {
    console.error("Auth start error", error);

    res.status(500).json({
      status: "error",
      message: "The verification service is temporarily unavailable."
    });
  }
});

app.post("/auth/verify", async (req, res) => {
  try {
    const { challengeId, code } = req.body || {};

    const challengeResult = await query(
      `
      SELECT *
      FROM otp_challenges
      WHERE challenge_id = $1
      `,
      [challengeId]
    );

    const challenge = challengeResult.rows[0];

    if (!challenge) {
      return res.status(404).json({
        verified: false,
        reason: "challenge_not_found",
        message: "Verification challenge was not found."
      });
    }

    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      await query("DELETE FROM otp_challenges WHERE challenge_id = $1", [
        challengeId
      ]);

      return res.status(401).json({
        verified: false,
        reason: "challenge_expired",
        message: "Verification code expired."
      });
    }

    if (String(code || "").trim() !== String(challenge.code)) {
      return res.status(401).json({
        verified: false,
        reason: "invalid_code",
        message: "Verification code did not match."
      });
    }

    const customer = await getCustomerById(challenge.customer_id);

    await query("DELETE FROM otp_challenges WHERE challenge_id = $1", [
      challengeId
    ]);

    return res.json({
      verified: true,
      customer: publicCustomer(customer),
      authLevel: "demo-email-otp",
      message: "Demo email verification successful."
    });
  } catch (error) {
    console.error("Auth verify error", error);

    res.status(500).json({
      verified: false,
      reason: "server_error",
      message: "The verification service is temporarily unavailable."
    });
  }
});

app.get("/customers/:customerId/profile", async (req, res) => {
  try {
    const customer = await getCustomerById(req.params.customerId);

    if (!customer) {
      return res.status(404).json({
        status: "not_found",
        message: "Customer not found."
      });
    }

    return res.json({
      customer: publicCustomer(customer)
    });
  } catch (error) {
    console.error("Customer profile error", error);

    res.status(500).json({
      status: "error",
      message: "Customer profile service is temporarily unavailable."
    });
  }
});

app.get("/customers/:customerId/activity", async (req, res) => {
  try {
    const customer = await getCustomerById(req.params.customerId);

    if (!customer) {
      return res.status(404).json({
        status: "not_found",
        message: "Customer not found."
      });
    }

    const activityResult = await query(
      `
      SELECT *
      FROM customer_activity
      WHERE customer_id = $1
      `,
      [req.params.customerId]
    );

    const activity = activityResult.rows[0];

    return res.json({
      customer: publicCustomer(customer),
      activity: activity
        ? {
            lastIntent: activity.last_intent,
            lastActionType: activity.last_action_type,
            lastActionSummary: activity.last_action_summary,
            lastTransactionId: activity.last_transaction_id,
            preferredLanguage: activity.preferred_language,
            lastSeenAt: activity.last_seen_at
          }
        : null
    });
  } catch (error) {
    console.error("Customer activity error", error);

    res.status(500).json({
      status: "error",
      message: "Customer activity service is temporarily unavailable."
    });
  }
});

app.get("/customers/:customerId/accounts", async (req, res) => {
  try {
    const customer = await getCustomerById(req.params.customerId);

    if (!customer) {
      return res.status(404).json({
        status: "not_found",
        message: "Customer not found."
      });
    }

    const accountsResult = await query(
      `
      SELECT *
      FROM accounts
      WHERE customer_id = $1
      ORDER BY account_type
      `,
      [req.params.customerId]
    );

    return res.json({
      customer: publicCustomer(customer),
      accounts: accountsResult.rows.map(publicAccount),
      summary: `Found ${accountsResult.rowCount} account records for ${customer.first_name}.`
    });
  } catch (error) {
    console.error("Accounts error", error);

    res.status(500).json({
      status: "error",
      message: "The account service is temporarily unavailable."
    });
  }
});

app.get("/customers/:customerId/transactions", async (req, res) => {
  try {
    const customer = await getCustomerById(req.params.customerId);

    if (!customer) {
      return res.status(404).json({
        status: "not_found",
        message: "Customer not found."
      });
    }

    const limit = Math.min(Number(req.query.limit || 5), 10);

    const transactionsResult = await query(
      `
      SELECT *
      FROM transactions
      WHERE customer_id = $1
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT $2
      `,
      [req.params.customerId, limit]
    );

    return res.json({
      customer: publicCustomer(customer),
      transactions: transactionsResult.rows.map(publicTransaction),
      summary: `Returned ${transactionsResult.rowCount} recent transactions.`
    });
  } catch (error) {
    console.error("Transactions error", error);

    res.status(500).json({
      status: "error",
      message: "The transaction service is temporarily unavailable."
    });
  }
});

app.post("/transfers/preview", async (req, res) => {
  try {
    const { customerId, fromAccountType, toAccountType, amount } = req.body || {};
    const customer = await getCustomerById(customerId);

    if (!customer) {
      return res.status(404).json({
        allowed: false,
        reason: "customer_not_found",
        message: "Customer not found."
      });
    }

    const fromAccount = await getAccountByType(customerId, fromAccountType);
    const toAccount = await getAccountByType(customerId, toAccountType);
    const transferAmount = money(amount);

    if (!fromAccount || !toAccount) {
      return res.status(400).json({
        allowed: false,
        reason: "account_not_found",
        message: "One or more accounts could not be found."
      });
    }

    if (fromAccount.account_id === toAccount.account_id) {
      return res.status(400).json({
        allowed: false,
        reason: "same_account",
        message: "The source and destination accounts must be different."
      });
    }

    if (fromAccount.account_type === "cd" || toAccount.account_type === "cd") {
      return res.status(400).json({
        allowed: false,
        reason: "cd_transfer_restricted",
        message:
          "CD transfers require maturity review or representative support."
      });
    }

    if (!transferAmount || transferAmount <= 0) {
      return res.status(400).json({
        allowed: false,
        reason: "invalid_amount",
        message: "Transfer amount must be greater than zero."
      });
    }

    if (transferAmount > 2500) {
      return res.status(400).json({
        allowed: false,
        reason: "single_transfer_limit",
        message: "Demo internal transfers are limited to $2,500 per transfer."
      });
    }

    if (transferAmount > Number(fromAccount.available_balance)) {
      return res.status(400).json({
        allowed: false,
        reason: "insufficient_funds",
        message: "The source account does not have enough available funds."
      });
    }

    const confirmationId = crypto.randomUUID();

    await query(
      `
      INSERT INTO transfer_previews (
        confirmation_id,
        customer_id,
        from_account_id,
        to_account_id,
        amount,
        currency,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, 'USD', NOW() + INTERVAL '10 minutes')
      `,
      [
        confirmationId,
        customerId,
        fromAccount.account_id,
        toAccount.account_id,
        transferAmount
      ]
    );

    return res.json({
      allowed: true,
      confirmationId,
      fromAccount: {
        type: fromAccount.account_type,
        displayName: fromAccount.display_name,
        maskedAccountNumber: fromAccount.masked_account_number
      },
      toAccount: {
        type: toAccount.account_type,
        displayName: toAccount.display_name,
        maskedAccountNumber: toAccount.masked_account_number
      },
      amount: transferAmount,
      currency: "USD",
      fee: 0,
      message: `Transfer preview approved for ${formatCurrency(
        transferAmount
      )} from ${fromAccount.account_type} to ${toAccount.account_type}.`
    });
  } catch (error) {
    console.error("Transfer preview error", error);

    res.status(500).json({
      allowed: false,
      reason: "server_error",
      message: "The transfer preview service is temporarily unavailable."
    });
  }
});

app.post("/transfers/confirm", async (req, res) => {
  try {
    const { confirmationId } = req.body || {};

    const previewResult = await query(
      `
      SELECT
        tp.*,
        fa.account_type AS from_account_type,
        fa.available_balance AS from_available_balance,
        fa.current_balance AS from_current_balance,
        ta.account_type AS to_account_type,
        ta.available_balance AS to_available_balance,
        ta.current_balance AS to_current_balance
      FROM transfer_previews tp
      JOIN accounts fa ON tp.from_account_id = fa.account_id
      JOIN accounts ta ON tp.to_account_id = ta.account_id
      WHERE tp.confirmation_id = $1
      `,
      [confirmationId]
    );

    const preview = previewResult.rows[0];

    if (!preview) {
      return res.status(404).json({
        completed: false,
        reason: "confirmation_not_found",
        message: "Transfer confirmation was not found."
      });
    }

    if (new Date(preview.expires_at).getTime() < Date.now()) {
      await query("DELETE FROM transfer_previews WHERE confirmation_id = $1", [
        confirmationId
      ]);

      return res.status(401).json({
        completed: false,
        reason: "confirmation_expired",
        message: "Transfer confirmation expired."
      });
    }

    const transferAmount = Number(preview.amount);
    const transferId = `trn_${crypto.randomUUID().slice(0, 8)}`;

    await query("BEGIN");

    await query(
      `
      UPDATE accounts
      SET
        available_balance = available_balance - $1,
        current_balance = current_balance - $1,
        updated_at = NOW()
      WHERE account_id = $2
      `,
      [transferAmount, preview.from_account_id]
    );

    await query(
      `
      UPDATE accounts
      SET
        available_balance = available_balance + $1,
        current_balance = current_balance + $1,
        updated_at = NOW()
      WHERE account_id = $2
      `,
      [transferAmount, preview.to_account_id]
    );

    await query(
      `
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
      )
      VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, 'posted', 'transfer')
      `,
      [
        transferId,
        preview.customer_id,
        preview.from_account_id,
        `Transfer to ${preview.to_account_type}`,
        -transferAmount,
        preview.from_account_type
      ]
    );

    await query("DELETE FROM transfer_previews WHERE confirmation_id = $1", [
      confirmationId
    ]);

    await query("COMMIT");

    const customer = await getCustomerById(preview.customer_id);

    await upsertActivity({
      customerId: preview.customer_id,
      lastIntent: "transfer_confirm",
      lastActionType: "transfer",
      lastActionSummary: `Transferred ${formatCurrency(transferAmount)} from ${
        preview.from_account_type
      } to ${preview.to_account_type}`,
      lastTransactionId: transferId,
      preferredLanguage: customer.preferred_language
    });

    return res.json({
      completed: true,
      transferId,
      amount: transferAmount,
      currency: "USD",
      fromAccount: {
        type: preview.from_account_type
      },
      toAccount: {
        type: preview.to_account_type
      },
      message: `Transfer complete. ${formatCurrency(
        transferAmount
      )} moved from ${preview.from_account_type} to ${
        preview.to_account_type
      }.`
    });
  } catch (error) {
    try {
      await query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback failed", rollbackError);
    }

    console.error("Transfer confirm error", error);

    res.status(500).json({
      completed: false,
      reason: "server_error",
      message: "The transfer confirmation service is temporarily unavailable."
    });
  }
});

app.post("/support/escalate", async (req, res) => {
  try {
    const { customerId, reason, summary } = req.body || {};
    const caseId = `case_${crypto.randomUUID().slice(0, 8)}`;

    if (customerId) {
      const customer = await getCustomerById(customerId);

      if (customer) {
        await upsertActivity({
          customerId,
          lastIntent: "support_escalation",
          lastActionType: "escalation",
          lastActionSummary:
            summary || "Customer requested representative support",
          preferredLanguage: customer.preferred_language
        });
      }
    }

    return res.json({
      escalated: true,
      caseId,
      customerId: customerId || null,
      reason: reason || "general_support",
      summary: summary || "Customer requested representative support.",
      message: "A demo support case was created for representative follow-up."
    });
  } catch (error) {
    console.error("Support escalation error", error);

    res.status(500).json({
      escalated: false,
      reason: "server_error",
      message: "The support escalation service is temporarily unavailable."
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    status: "not_found",
    message: "Endpoint not found."
  });
});

app.listen(PORT, () => {
  console.log(`Acme Bank Mock API listening on port ${PORT}`);
});
