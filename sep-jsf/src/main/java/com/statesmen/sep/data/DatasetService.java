package com.statesmen.sep.data;

import com.statesmen.sep.model.ColumnDef;
import com.statesmen.sep.model.DatasetInfo;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;

import java.time.LocalDate;
import java.util.*;

@Named
@ApplicationScoped
public class DatasetService {

    // ── Payment row factory lookups (mirrors rowFactory.js) ───────────────────
    private static final String[] CARRIERS        = {"Aetna", "Cigna", "United", "Humana"};
    private static final String[] STATUSES        = {"Paid", "Failed", "Pending"};
    private static final String[] PAY_METHODS     = {"ACH", "Credit Card", "Wire"};
    private static final String[] REGIONS         = {"Southeast", "Midwest", "Northeast", "South", "West", "East"};
    private static final String[] PREFIXES = {
        "Oak Valley","Summit Ridge","Riverbend","Cedar Point","Maple Harbor",
        "Pinecrest","Lakeside","Brightstone","Silverline","Westhaven",
        "Redwood","Clearwater","Northstar","Ironwood","Bluewater",
        "Fairview","Granite","Hearthside","Keystone","Mariner",
        "Parkway","Rosemont","Stonebridge","Windward"
    };
    private static final String[] SUFFIXES = {
        "Benefits","Insurance","Risk Advisors","Employee Plans",
        "Coverage Group","Health Partners","Benefit Services","Underwriters"
    };

    // ── Candy generation lookups (mirrors candy.js) ───────────────────────────
    private static final String[][] PRODUCTS = {
        {"Milk Chocolate Bar",     "Chocolate",  "3.99"},
        {"Dark Chocolate Truffle", "Chocolate",  "7.49"},
        {"White Chocolate Bark",   "Chocolate",  "5.99"},
        {"Caramel Chocolate",      "Chocolate",  "4.49"},
        {"Peanut Butter Cup",      "Chocolate",  "2.99"},
        {"Gummy Bears",            "Gummy",      "2.49"},
        {"Gummy Worms",            "Gummy",      "2.49"},
        {"Peach Rings",            "Gummy",      "1.99"},
        {"Sour Gummy Worms",       "Gummy",      "2.99"},
        {"Peppermint Twist",       "Hard Candy", "1.49"},
        {"Butterscotch Drop",      "Hard Candy", "1.29"},
        {"Rock Candy",             "Hard Candy", "3.49"},
        {"Sour Patch Kids",        "Sour",       "3.29"},
        {"Sour Belts",             "Sour",       "2.79"},
        {"Warheads",               "Sour",       "1.99"},
        {"Classic Lollipop",       "Lollipop",   "0.99"},
        {"Ring Pop",               "Lollipop",   "1.49"},
        {"Blow Pop",               "Lollipop",   "1.29"},
        {"Pop Rocks",              "Novelty",    "1.99"},
        {"Fun Dip",                "Novelty",    "1.49"},
        {"Jawbreaker",             "Novelty",    "0.79"},
        {"Candy Necklace",         "Novelty",    "1.99"},
    };
    private static final String[][] STORES = {
        {"Main Street",  "North"},
        {"Mall Kiosk",   "East"},
        {"Airport Shop", "Central"},
        {"Downtown",     "South"},
        {"Online",       "Online"},
    };
    private static final String[] SEGMENTS  = {"Kids","Teens","Young Adults","Adults","Seniors"};
    private static final String[] OCCASIONS = {"Impulse","Gifting","Personal Treat","Party / Event","Holiday"};
    private static final String[] CHANNELS  = {"In-Store Display","Social Media Ad","Email Campaign","Word of Mouth","No Attribution"};
    private static final String[] PROMOS    = {"None","Percent Discount","BOGO","Bundle Deal","Seasonal"};
    private static final String[] CUST_TYPES= {"New","Returning","Loyal"};
    private static final String[] CANDY_PAY = {"Cash","Credit Card","Debit Card","Gift Card"};
    private static final String[] MONTHS    = {
        "January","February","March","April","May","June",
        "July","August","September","October","November","December"
    };
    private static final double[][] SEG_WEIGHTS = {
        {5,  15, 20, 35, 25},  // Chocolate
        {35, 30, 20, 10,  5},  // Gummy
        {5,  10, 15, 35, 35},  // Hard Candy
        {18, 42, 28, 10,  2},  // Sour
        {5,  10, 15, 35, 35},  // Hard Candy (duplicate for safety)
        {50, 25, 15,  8,  2},  // Lollipop
        {40, 35, 15,  8,  2},  // Novelty
    };
    private static final Set<String> WEAK_SELLERS = new HashSet<>(Arrays.asList(
        "Classic Lollipop","Gummy Worms","Candy Necklace","Butterscotch Drop"
    ));

    @Inject
    private SepApiService sepApiService;

    private final Map<String, DatasetInfo> datasets = new LinkedHashMap<>();

    // Mulberry32 PRNG state — used only during buildCandy()
    private int randSeed;

    @PostConstruct
    public void init() {
        datasets.put("payments",    buildPayments());
        datasets.put("adjustments", buildAdjustments());
        datasets.put("exceptions",  buildExceptions());
        datasets.put("candy",       buildCandy());
    }

    public DatasetInfo getDataset(String id) {
        return datasets.getOrDefault(id, datasets.values().iterator().next());
    }

    public Collection<DatasetInfo> getAllDatasets() { return datasets.values(); }

    // ── Mulberry32 PRNG — exact Java port of seededRand(42) in candy.js ──────
    // Java int arithmetic wraps at 32 bits identically to JS's `| 0` coercion.

    private void seedRand(int seed) { randSeed = seed; }

    private double nextRand() {
        randSeed += 0x6d2b79f5;
        int t = (randSeed ^ (randSeed >>> 15)) * (1 | randSeed);
        t = (t + ((t ^ (t >>> 7)) * (61 | t))) ^ t;
        return ((long)(t ^ (t >>> 14)) & 0xFFFFFFFFL) / 4294967296.0;
    }

    private int pickIdx(double[] weights) {
        double total = 0; for (double w : weights) total += w;
        double r = nextRand() * total;
        for (int i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
        return weights.length - 1;
    }

    private double[] segWeightsFor(String category) {
        return switch (category) {
            case "Chocolate"  -> SEG_WEIGHTS[0];
            case "Gummy"      -> SEG_WEIGHTS[1];
            case "Hard Candy" -> SEG_WEIGHTS[2];
            case "Sour"       -> SEG_WEIGHTS[3];
            case "Lollipop"   -> SEG_WEIGHTS[5];
            default           -> SEG_WEIGHTS[6]; // Novelty
        };
    }

    private double[] occasionWeights(int month1) {
        if (month1 == 1 || month1 == 2)            return new double[]{20, 30, 20, 10, 20};
        if (month1 == 10)                           return new double[]{20, 10, 15, 20, 35};
        if (month1 == 11 || month1 == 12)           return new double[]{15, 30, 15, 10, 30};
        return new double[]{40, 10, 35, 12, 3};
    }

    private double[] channelWeights(String store) {
        return "Online".equals(store) ? new double[]{2, 38, 32, 18, 10} : new double[]{45, 15, 10, 25, 5};
    }

    private double[] promoWeights(int month1) {
        if (month1 == 10 || month1 == 11 || month1 == 12) return new double[]{50, 12,  8,  8, 22};
        if (month1 == 1  || month1 == 2)                  return new double[]{55, 18, 10, 12,  5};
        return new double[]{70, 12, 8, 8, 2};
    }

    // ── Column definitions ────────────────────────────────────────────────────

    // Columns for live SEP API transactions
    private List<ColumnDef> sepTransactionColumns() {
        return Arrays.asList(
            new ColumnDef("referenceNumber", "Reference #",    false, false),
            new ColumnDef("billingName",     "Customer",       false, false),
            new ColumnDef("insuredName",     "Insured",        false, false),
            new ColumnDef("policyNumber",    "Policy #",       false, false),
            new ColumnDef("amount",          "Amount",         true,  true),
            new ColumnDef("status",          "Status",         false, false),
            new ColumnDef("depositDate",     "Date",           false, false),
            new ColumnDef("authCode",        "Auth Code",      false, false),
            new ColumnDef("email",           "Email",          false, false),
            new ColumnDef("message",         "Result",         false, false),
            new ColumnDef("transNumber",     "Transaction ID", false, false)
        );
    }

    // Columns for local demo payment data
    private List<ColumnDef> paymentColumns() {
        return Arrays.asList(
            new ColumnDef("paymentId",     "Payment ID",     true,  false),
            new ColumnDef("customer",      "Customer",       false, false),
            new ColumnDef("carrier",       "Carrier",        false, false),
            new ColumnDef("policyNumber",  "Policy Number",  false, false),
            new ColumnDef("amount",        "Amount",         true,  true),
            new ColumnDef("status",        "Status",         false, false),
            new ColumnDef("paymentMethod", "Payment Method", false, false),
            new ColumnDef("invoiceDate",   "Invoice Date",   false, false),
            new ColumnDef("region",        "Region",         false, false)
        );
    }

    private List<ColumnDef> candyColumns() {
        return Arrays.asList(
            new ColumnDef("saleId",           "Sale ID",           false, false),
            new ColumnDef("date",             "Date",              false, false),
            new ColumnDef("month",            "Month",             false, false),
            new ColumnDef("product",          "Product",           false, false),
            new ColumnDef("category",         "Category",          false, false),
            new ColumnDef("store",            "Store",             false, false),
            new ColumnDef("region",           "Region",            false, false),
            new ColumnDef("customerSegment",  "Customer Segment",  false, false),
            new ColumnDef("customerType",     "Customer Type",     false, false),
            new ColumnDef("purchaseOccasion", "Purchase Occasion", false, false),
            new ColumnDef("marketingChannel", "Marketing Channel", false, false),
            new ColumnDef("promoType",        "Promo Type",        false, false),
            new ColumnDef("discountPct",      "Discount %",        true,  false),
            new ColumnDef("quantity",         "Quantity",          true,  false),
            new ColumnDef("unitPrice",        "Unit Price",        true,  true),
            new ColumnDef("grossTotal",       "Gross Total",       true,  true),
            new ColumnDef("total",            "Total",             true,  true),
            new ColumnDef("satisfaction",     "Satisfaction",      true,  false),
            new ColumnDef("paymentMethod",    "Payment Method",    false, false)
        );
    }

    // ── Row helpers ───────────────────────────────────────────────────────────

    private Map<String, Object> payment(int id, String customer, String carrier,
                                        String policy, double amount, String status,
                                        String method, String date, String region) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("paymentId", id); r.put("customer", customer); r.put("carrier", carrier);
        r.put("policyNumber", policy); r.put("amount", amount); r.put("status", status);
        r.put("paymentMethod", method); r.put("invoiceDate", date); r.put("region", region);
        return r;
    }

    // ── Payment row factory (mirrors rowFactory.js::buildDatasetRows) ─────────

    private Map<String, Object> makeGeneratedRow(int index, int idBase, String policyPrefix,
                                                  int policyStart, String dateStart,
                                                  int statusOffset, double amountBase,
                                                  double amountStep, int customerOffset) {
        LocalDate date  = LocalDate.parse(dateStart).plusDays((long) index * 2);
        String status   = STATUSES[(index + statusOffset) % STATUSES.length];
        String carrier  = CARRIERS[(index + customerOffset) % CARRIERS.length];
        String payMethod= PAY_METHODS[(index + statusOffset + 1) % PAY_METHODS.length];
        String region   = REGIONS[(index + statusOffset + customerOffset) % REGIONS.length];
        String customer = PREFIXES[(index + customerOffset) % PREFIXES.length] + " "
                        + SUFFIXES[index % SUFFIXES.length];
        String policy   = policyPrefix + "-" + String.format("%03d", policyStart + index + 1);
        double bump     = "Failed".equals(status) ? 1800 : "Pending".equals(status) ? 950 : 0;
        double amount   = Math.round((amountBase + ((index * amountStep) % 7200) + bump) * 100.0) / 100.0;
        return payment(idBase + index + 1, customer, carrier, policy, amount,
                       status, payMethod, date.toString(), region);
    }

    private List<Map<String, Object>> buildRows(List<Map<String, Object>> base,
                                                int idBase, String prefix, int policyStart,
                                                String dateStart, int statusOff,
                                                double amtBase, double amtStep, int custOff) {
        List<Map<String, Object>> rows = new ArrayList<>(base);
        for (int i = rows.size(); i < 50; i++)
            rows.add(makeGeneratedRow(i, idBase, prefix, policyStart, dateStart,
                                      statusOff, amtBase, amtStep, custOff));
        return rows;
    }

    // ── Payments Baseline ─────────────────────────────────────────────────────

    private DatasetInfo buildPayments() {
        // Prefer live SEP API data; fall back to local demo rows if the key is absent or the call fails
        List<Map<String, Object>> apiRows = sepApiService.fetchTransactions(
                "2020-01-01T00:00:00Z", "2030-12-31T23:59:59Z");

        if (!apiRows.isEmpty()) {
            return new DatasetInfo("payments", "SEP Transactions",
                    sepTransactionColumns(), apiRows);
        }

        // ── Local demo fallback ───────────────────────────────────────────────
        List<Map<String, Object>> base = new ArrayList<>(Arrays.asList(
            payment(1001,"Acme Insurance Group",       "Aetna", "POL-001",1250.45,"Paid",   "ACH",         "2026-05-01","Southeast"),
            payment(1002,"Blue Ridge Health",          "Cigna", "POL-002",2400.00,"Failed", "Credit Card", "2026-05-03","Midwest"),
            payment(1003,"NC Mutual",                  "Aetna", "POL-003",3400.75,"Pending","Wire",        "2026-05-05","Southeast"),
            payment(1004,"Carolina Benefits",          "United","POL-004", 890.15,"Paid",   "ACH",         "2026-05-07","West"),
            payment(1005,"Premier Insurance Services", "Humana","POL-005",5000.00,"Failed", "Credit Card", "2026-05-10","Northeast"),
            payment(1006,"Triangle Risk Advisors",     "Cigna", "POL-006",1800.20,"Paid",   "ACH",         "2026-05-12","South"),
            payment(1007,"Metro Employee Benefits",    "United","POL-007",2150.80,"Pending","Wire",        "2026-05-15","Midwest"),
            payment(1008,"Atlantic Insurance Brokers", "Aetna", "POL-008",4125.33,"Failed", "ACH",         "2026-05-18","East")
        ));
        return new DatasetInfo("payments", "Payments (Demo)",
                paymentColumns(), buildRows(base,1000,"POL",0,"2026-05-20",0,725,387.45,0));
    }

    // ── Rebills & Adjustments ─────────────────────────────────────────────────

    private DatasetInfo buildAdjustments() {
        List<Map<String, Object>> base = new ArrayList<>(Arrays.asList(
            payment(2001,"Summit Benefit Advisors","Aetna", "ADJ-101", 410.25,"Pending","ACH",         "2026-04-04","Midwest"),
            payment(2002,"Sandhill Coverage",      "Humana","ADJ-102", 980.00,"Paid",   "Wire",        "2026-04-09","South"),
            payment(2003,"Delta Group Health",     "Cigna", "ADJ-103",1450.75,"Failed", "Credit Card", "2026-04-11","Southeast"),
            payment(2004,"Monarch Employee Plans", "United","ADJ-104", 520.00,"Paid",   "ACH",         "2026-04-14","West"),
            payment(2005,"Harborline Financial",   "Cigna", "ADJ-105",2675.42,"Pending","Wire",        "2026-04-18","Northeast"),
            payment(2006,"Old Town Brokerage",     "Aetna", "ADJ-106", 320.00,"Paid",   "ACH",         "2026-04-22","South"),
            payment(2007,"Apex Risk Network",      "United","ADJ-107",1780.14,"Failed", "Credit Card", "2026-04-26","Midwest"),
            payment(2008,"Springfield Benefits",   "Humana","ADJ-108", 830.33,"Pending","ACH",         "2026-04-30","Southeast")
        ));
        return new DatasetInfo("adjustments","Rebills & Adjustments", paymentColumns(),
            buildRows(base,2000,"ADJ",100,"2026-05-02",1,340,291.8,3));
    }

    // ── Exceptions Queue ──────────────────────────────────────────────────────

    private DatasetInfo buildExceptions() {
        List<Map<String, Object>> base = new ArrayList<>(Arrays.asList(
            payment(3001,"Bridgeway Underwriters",  "United","EXC-201",6120.90,"Failed", "Wire",        "2026-03-02","West"),
            payment(3002,"Pioneer Benefit Group",   "Aetna", "EXC-202",1125.00,"Pending","ACH",         "2026-03-04","Northeast"),
            payment(3003,"Northgate Insurance",     "Cigna", "EXC-203",2999.99,"Failed", "Credit Card", "2026-03-08","South"),
            payment(3004,"Greenfield Associates",   "Humana","EXC-204", 455.85,"Pending","ACH",         "2026-03-13","East"),
            payment(3005,"Sterling Coverage Co",    "United","EXC-205", 718.70,"Paid",   "Wire",        "2026-03-16","Midwest"),
            payment(3006,"Palisade Benefits",       "Aetna", "EXC-206",5200.13,"Failed", "Credit Card", "2026-03-21","Southeast"),
            payment(3007,"Crescent Health Partners","Cigna", "EXC-207",1340.00,"Pending","ACH",         "2026-03-25","West"),
            payment(3008,"Frontier Insurance Desk", "Humana","EXC-208", 680.44,"Paid",   "ACH",         "2026-03-29","South")
        ));
        return new DatasetInfo("exceptions","Exceptions Queue", paymentColumns(),
            buildRows(base,3000,"EXC",200,"2026-04-01",2,980,524.6,6));
    }

    // ── Candy Store Sales — 200 rows via mulberry32 PRNG (seed=42) ───────────
    // Logic is a faithful Java port of candy.js; should produce equivalent data.

    private DatasetInfo buildCandy() {
        seedRand(42);
        List<Map<String, Object>> rows = new ArrayList<>(200);

        for (int i = 0; i < 200; i++) {
            int dayOfYear = (int)(nextRand() * 365);
            LocalDate date = LocalDate.of(2024, 1, 1).plusDays(dayOfYear);
            int month  = date.getMonthValue() - 1; // 0-based, matching JS getMonth()
            int month1 = month + 1;

            // Product — seasonal weighting (mirrors candy.js exactly)
            double[] productWeights = new double[PRODUCTS.length];
            for (int j = 0; j < PRODUCTS.length; j++) {
                String cat = PRODUCTS[j][1];
                productWeights[j] = switch (cat) {
                    case "Chocolate"  -> (month <= 1 || month >= 10 || month == 3) ? 2.5 : 1;
                    case "Gummy","Sour"->  (month >= 5 && month <= 8) ? 2 : 1;
                    case "Novelty"    ->  month == 9 ? 3 : 1;
                    default           ->  1;
                };
            }
            String[] product = PRODUCTS[pickIdx(productWeights)];

            String[] store = STORES[(int)(nextRand() * STORES.length)];

            String segment  = SEGMENTS [pickIdx(segWeightsFor(product[1]))];
            String occasion = OCCASIONS[pickIdx(occasionWeights(month1))];
            String channel  = CHANNELS [pickIdx(channelWeights(store[0]))];
            String promo    = PROMOS   [pickIdx(promoWeights(month1))];
            String custType = CUST_TYPES[pickIdx(new double[]{28, 50, 22})];

            int satisfaction = new int[]{1,2,3,4,5}[pickIdx(
                WEAK_SELLERS.contains(product[0])
                    ? new double[]{6, 14, 28, 32, 20}
                    : new double[]{2,  5, 16, 38, 39}
            )];

            int discountPct = switch (promo) {
                case "None"             -> 0;
                case "BOGO"             -> 50;
                case "Bundle Deal"      -> 15;
                case "Seasonal"         -> 25;
                default                 -> new int[]{10,15,20}[pickIdx(new double[]{40,35,25})]; // Percent Discount
            };

            int baseQty = "Loyal".equals(custType) ? 6 : 1;
            int maxQty  = "Loyal".equals(custType) ? 30 : 24;
            int quantity = baseQty + (int)(nextRand() * (maxQty - baseQty + 1));

            double unitPrice  = Double.parseDouble(product[2]);
            double grossTotal = Math.round(unitPrice * quantity * 100.0) / 100.0;
            double total      = Math.round(grossTotal * (1 - discountPct / 100.0) * 100.0) / 100.0;
            String payMethod  = CANDY_PAY[pickIdx(new double[]{20, 45, 25, 10})];

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("saleId",           String.format("CS-%04d", i + 1));
            row.put("date",             date.toString());
            row.put("month",            MONTHS[month]);
            row.put("product",          product[0]);
            row.put("category",         product[1]);
            row.put("store",            store[0]);
            row.put("region",           store[1]);
            row.put("customerSegment",  segment);
            row.put("customerType",     custType);
            row.put("purchaseOccasion", occasion);
            row.put("marketingChannel", channel);
            row.put("promoType",        promo);
            row.put("discountPct",      discountPct);
            row.put("quantity",         quantity);
            row.put("unitPrice",        unitPrice);
            row.put("grossTotal",       grossTotal);
            row.put("total",            total);
            row.put("satisfaction",     satisfaction);
            row.put("paymentMethod",    payMethod);
            rows.add(row);
        }

        return new DatasetInfo("candy", "Candy Store Sales", candyColumns(), rows);
    }
}
