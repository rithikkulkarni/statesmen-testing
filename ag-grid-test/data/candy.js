// Seeded RNG (mulberry32) — deterministic 200-row candy sales + marketing dataset
function seededRand(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = seededRand(42);

function pickWeighted(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ── Products ────────────────────────────────────────────────────────────────

const products = [
  { name: 'Milk Chocolate Bar',     category: 'Chocolate',  unitPrice: 3.99 },
  { name: 'Dark Chocolate Truffle', category: 'Chocolate',  unitPrice: 7.49 },
  { name: 'White Chocolate Bark',   category: 'Chocolate',  unitPrice: 5.99 },
  { name: 'Caramel Chocolate',      category: 'Chocolate',  unitPrice: 4.49 },
  { name: 'Peanut Butter Cup',      category: 'Chocolate',  unitPrice: 2.99 },
  { name: 'Gummy Bears',            category: 'Gummy',      unitPrice: 2.49 },
  { name: 'Gummy Worms',            category: 'Gummy',      unitPrice: 2.49 },
  { name: 'Peach Rings',            category: 'Gummy',      unitPrice: 1.99 },
  { name: 'Sour Gummy Worms',       category: 'Gummy',      unitPrice: 2.99 },
  { name: 'Peppermint Twist',       category: 'Hard Candy', unitPrice: 1.49 },
  { name: 'Butterscotch Drop',      category: 'Hard Candy', unitPrice: 1.29 },
  { name: 'Rock Candy',             category: 'Hard Candy', unitPrice: 3.49 },
  { name: 'Sour Patch Kids',        category: 'Sour',       unitPrice: 3.29 },
  { name: 'Sour Belts',             category: 'Sour',       unitPrice: 2.79 },
  { name: 'Warheads',               category: 'Sour',       unitPrice: 1.99 },
  { name: 'Classic Lollipop',       category: 'Lollipop',   unitPrice: 0.99 },
  { name: 'Ring Pop',               category: 'Lollipop',   unitPrice: 1.49 },
  { name: 'Blow Pop',               category: 'Lollipop',   unitPrice: 1.29 },
  { name: 'Pop Rocks',              category: 'Novelty',    unitPrice: 1.99 },
  { name: 'Fun Dip',                category: 'Novelty',    unitPrice: 1.49 },
  { name: 'Jawbreaker',             category: 'Novelty',    unitPrice: 0.79 },
  { name: 'Candy Necklace',         category: 'Novelty',    unitPrice: 1.99 },
];

// ── Stores ───────────────────────────────────────────────────────────────────

const storeList = [
  { store: 'Main Street',  region: 'North'   },
  { store: 'Mall Kiosk',   region: 'East'    },
  { store: 'Airport Shop', region: 'Central' },
  { store: 'Downtown',     region: 'South'   },
  { store: 'Online',       region: 'Online'  },
];

// ── Static lookup lists ───────────────────────────────────────────────────────

const paymentMethods    = ['Cash', 'Credit Card', 'Debit Card', 'Gift Card'];
const customerSegments  = ['Kids', 'Teens', 'Young Adults', 'Adults', 'Seniors'];
const purchaseOccasions = ['Impulse', 'Gifting', 'Personal Treat', 'Party / Event', 'Holiday'];
const marketingChannels = ['In-Store Display', 'Social Media Ad', 'Email Campaign', 'Word of Mouth', 'No Attribution'];
const promoTypes        = ['None', 'Percent Discount', 'BOGO', 'Bundle Deal', 'Seasonal'];
const customerTypes     = ['New', 'Returning', 'Loyal'];
const months = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ── Weighting tables ──────────────────────────────────────────────────────────

// customerSegments order: Kids / Teens / Young Adults / Adults / Seniors
const segmentWeightsByCategory = {
  'Chocolate':  [5,  15, 20, 35, 25],
  'Gummy':      [35, 30, 20, 10,  5],
  'Sour':       [18, 42, 28, 10,  2],
  'Hard Candy': [5,  10, 15, 35, 35],
  'Lollipop':   [50, 25, 15,  8,  2],
  'Novelty':    [40, 35, 15,  8,  2],
};

// purchaseOccasions order: Impulse / Gifting / Personal Treat / Party+Event / Holiday
function occasionWeights(month) {
  if (month === 1 || month === 2)  return [20, 30, 20, 10, 20]; // Jan–Feb (Valentine's)
  if (month === 10)                return [20, 10, 15, 20, 35]; // October (Halloween)
  if (month === 11 || month === 12)return [15, 30, 15, 10, 30]; // Nov–Dec (holidays)
  return [40, 10, 35, 12, 3];
}

// marketingChannels order: In-Store Display / Social Media Ad / Email Campaign / Word of Mouth / No Attribution
function channelWeights(store) {
  if (store === 'Online') return [2, 38, 32, 18, 10];
  return [45, 15, 10, 25, 5];
}

// promoTypes order: None / Percent Discount / BOGO / Bundle Deal / Seasonal
function promoWeights(month) {
  if (month === 10 || month === 11 || month === 12) return [50, 12, 8, 8, 22];
  if (month === 1 || month === 2)                   return [55, 18, 10, 12, 5];
  return [70, 12, 8, 8, 2];
}

const discountByPromoType = {
  'None':             0,
  'Percent Discount': null, // chosen randomly: 10, 15, or 20
  'BOGO':             50,
  'Bundle Deal':      15,
  'Seasonal':         25,
};

// satisfaction 1–5, order: [1,2,3,4,5]
function satisfactionWeights(product) {
  // Weakest sellers get a slightly worse satisfaction profile
  const weakSellers = ['Classic Lollipop', 'Gummy Worms', 'Candy Necklace', 'Butterscotch Drop'];
  if (weakSellers.includes(product)) return [6, 14, 28, 32, 20];
  return [2,  5, 16, 38, 39];
}

// ── Row generation ────────────────────────────────────────────────────────────

const rows = [];

for (let i = 0; i < 200; i++) {
  const dayOfYear = Math.floor(rand() * 365);
  const date = new Date(2024, 0, 1);
  date.setDate(date.getDate() + dayOfYear);
  const month  = date.getMonth();      // 0-based
  const month1 = month + 1;            // 1-based for comparisons

  // Product — seasonal weighting
  const productWeights = products.map((p) => {
    if (p.category === 'Chocolate') return (month <= 1 || month >= 10 || month === 3) ? 2.5 : 1;
    if (p.category === 'Gummy' || p.category === 'Sour') return (month >= 5 && month <= 8) ? 2 : 1;
    if (p.category === 'Novelty') return month === 9 ? 3 : 1;
    return 1;
  });
  const product = pickWeighted(products, productWeights);

  const { store, region } = storeList[Math.floor(rand() * storeList.length)];

  // Marketing fields
  const customerSegment  = pickWeighted(customerSegments, segmentWeightsByCategory[product.category]);
  const purchaseOccasion = pickWeighted(purchaseOccasions, occasionWeights(month1));
  const marketingChannel = pickWeighted(marketingChannels, channelWeights(store));
  const promoType        = pickWeighted(promoTypes, promoWeights(month1));
  const customerType     = pickWeighted(customerTypes, [28, 50, 22]);
  const satisfaction     = pickWeighted([1, 2, 3, 4, 5], satisfactionWeights(product.name));

  let discountPct = discountByPromoType[promoType];
  if (discountPct === null) discountPct = pickWeighted([10, 15, 20], [40, 35, 25]);

  // Loyal customers tend to buy more
  const baseQty     = customerType === 'Loyal' ? 6 : 1;
  const maxQty      = customerType === 'Loyal' ? 30 : 24;
  const quantity    = baseQty + Math.floor(rand() * (maxQty - baseQty + 1));

  const grossTotal  = Math.round(product.unitPrice * quantity * 100) / 100;
  const total       = Math.round(grossTotal * (1 - discountPct / 100) * 100) / 100;
  const paymentMethod = pickWeighted(paymentMethods, [20, 45, 25, 10]);

  rows.push({
    saleId:           `CS-${String(i + 1).padStart(4, '0')}`,
    date:             date.toISOString().slice(0, 10),
    month:            months[month],
    product:          product.name,
    category:         product.category,
    store,
    region,
    customerSegment,
    customerType,
    purchaseOccasion,
    marketingChannel,
    promoType,
    discountPct,
    quantity,
    unitPrice:        product.unitPrice,
    grossTotal,
    total,
    satisfaction,
    paymentMethod,
  });
}

export const candyRows = rows;
