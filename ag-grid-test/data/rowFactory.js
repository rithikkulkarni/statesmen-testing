const carriers = ['Aetna', 'Cigna', 'United', 'Humana'];
const statuses = ['Paid', 'Failed', 'Pending'];
const paymentMethods = ['ACH', 'Credit Card', 'Wire'];
const regions = ['Southeast', 'Midwest', 'Northeast', 'South', 'West', 'East'];
const customerPrefixes = [
  'Oak Valley',
  'Summit Ridge',
  'Riverbend',
  'Cedar Point',
  'Maple Harbor',
  'Pinecrest',
  'Lakeside',
  'Brightstone',
  'Silverline',
  'Westhaven',
  'Redwood',
  'Clearwater',
  'Northstar',
  'Ironwood',
  'Bluewater',
  'Fairview',
  'Granite',
  'Hearthside',
  'Keystone',
  'Mariner',
  'Parkway',
  'Rosemont',
  'Stonebridge',
  'Windward',
];
const customerSuffixes = [
  'Benefits',
  'Insurance',
  'Risk Advisors',
  'Employee Plans',
  'Coverage Group',
  'Health Partners',
  'Benefit Services',
  'Underwriters',
];

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function makeGeneratedRow(index, options) {
  const {
    idBase,
    policyPrefix,
    policyStart = 0,
    dateStart,
    statusOffset = 0,
    amountBase,
    amountStep,
    customerOffset = 0,
  } = options;
  const generatedIndex = index + 1;
  const date = new Date(`${dateStart}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + index * 2);

  const status = statuses[(index + statusOffset) % statuses.length];
  const carrier = carriers[(index + customerOffset) % carriers.length];
  const paymentMethod = paymentMethods[(index + statusOffset + 1) % paymentMethods.length];
  const amountBump = status === 'Failed' ? 1800 : status === 'Pending' ? 950 : 0;
  const amount = amountBase + ((index * amountStep) % 7200) + amountBump;

  return {
    paymentId: idBase + generatedIndex,
    customer: `${customerPrefixes[(index + customerOffset) % customerPrefixes.length]} ${customerSuffixes[index % customerSuffixes.length]}`,
    carrier,
    policyNumber: `${policyPrefix}-${String(policyStart + generatedIndex).padStart(3, '0')}`,
    amount: Number(amount.toFixed(2)),
    status,
    paymentMethod,
    invoiceDate: formatDate(date),
    region: regions[(index + statusOffset + customerOffset) % regions.length],
  };
}

export function buildDatasetRows(baseRows, options) {
  const rows = [...baseRows];
  const targetCount = options.targetCount || 50;

  for (let index = rows.length; index < targetCount; index += 1) {
    rows.push(makeGeneratedRow(index, options));
  }

  return rows;
}
