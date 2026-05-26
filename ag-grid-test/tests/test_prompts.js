const aiTestPrompts = [
  // Basic manipulation
  "Show only customer, carrier, amount, status, and invoice date.",
  "Hide payment ID and policy number.",
  "Move status and amount to the front of the table.",
  "Sort the table by amount from highest to lowest.",
  "Show the most recent invoices first.",
  "Filter to only failed payments.",
  "Show only ACH payments.",
  "Only show payments over $2,000.",
  "Show failed payments over $2,000.",
  "Show Aetna and Cigna records only.",

  // Business realistic
  "Show me high-value failed payments, with the largest amounts first.",
  "I only care about failed or pending payments. Hide everything else.",
  "Show unresolved payments by customer and amount.",
  "Create a collections view for payments that need follow-up.",
  "Show payment issues by carrier.",
  "Show me failed credit card payments.",
  "Find ACH payments that are still pending.",
  "Show me all records from the Southeast region.",
  "Show Northeast and Midwest records sorted by invoice date.",

  // Grouping / aggregation
  "Group payments by carrier and show the total amount for each carrier.",
  "Group by status and subtotal the amount.",
  "Group failed payments by region.",
  "Group by payment method and show total amount.",
  "Show total payment amount by carrier, sorted highest to lowest.",
  "Group by region, then by carrier.",

  // Dataset switching
  "Switch to the Rebills & Adjustments dataset.",
  "Open the Exceptions Queue.",
  "Use the Payments Baseline dataset and show only failed records.",
  "Switch to adjustments and show pending items over $1,000.",
  "Open exceptions and show high-value failed payments.",

  // Save / load view behavior
  "Create a saved view called Failed Payments Follow-Up.",
  "Save this table setup as Carrier Breakdown.",
  "Load my Failed Payments Follow-Up view.",
  "Save this as a collections review table.",

  // Compound realistic prompts
  "Show me failed payments over $2,000, grouped by carrier, with amount totals.",
  "Create a follow-up view with only customer, carrier, amount, status, and payment method. Show failed and pending payments first.",
  "Switch to the Exceptions Queue and show high-value failed payments sorted from largest to smallest.",
  "Group payments by region and carrier, then show total amount for each group.",
  "Show pending ACH payments and move customer, amount, and invoice date to the front.",
  "Create a clean executive view showing carrier, status, region, and total amount grouped by carrier.",

  // Edge cases / ambiguity testing
  "Show the bad payments.",
  "Show the important ones.",
  "Find suspicious payments.",
  "Show the big failed ones.",
  "Show stuff that needs attention.",
  "Clean this table up for me.",
  "Make this easier to review.",
  "Show only relevant columns.",
  "Prioritize exceptions.",
  "Organize this for collections review."
];

module.exports = { aiTestPrompts };
