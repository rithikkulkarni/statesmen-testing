package com.statesmen.sep.data;

import com.google.gson.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

/**
 * Thin client for the Simply Easier Payments REST API.
 * Reads credentials from environment variables set at startup:
 *   SEP_API_SECRET_KEY      — API secret key (used as Basic Auth username)
 *   SEP_API_TEST_ENDPOINT   — base URL (defaults to the SEP test environment)
 *
 * All public methods return empty collections on any failure so callers
 * can fall back to local demo data without crashing.
 */
@Named
@ApplicationScoped
public class SepApiService {

    private static final String API_KEY  = System.getenv("SEP_API_SECRET_KEY");
    private static final String BASE_URL = System.getenv().getOrDefault(
            "SEP_API_TEST_ENDPOINT",
            "https://test.simply-easier-payments.com/PaymentApp/restSrv");

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Calls POST /v1/PaymentSrv/getTransactionList and returns the flattened
     * transaction rows ready for the DataTable.  Returns an empty list on any
     * error (network failure, non-200 response, parse error, missing key).
     */
    public List<Map<String, Object>> fetchTransactions(String fromTime, String toTime) {
        if (API_KEY == null || API_KEY.isBlank()) {
            System.out.println("[SepApiService] SEP_API_SECRET_KEY not set — using local demo data");
            return Collections.emptyList();
        }
        try {
            String url         = BASE_URL + "/v1/PaymentSrv/getTransactionList";
            String credentials = Base64.getEncoder()
                    .encodeToString((API_KEY + ":").getBytes(StandardCharsets.UTF_8));

            JsonObject body = new JsonObject();
            body.addProperty("fromTime", fromTime);
            body.addProperty("toTime",   toTime);

            HttpResponse<String> resp = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(15))
                    .build()
                    .send(HttpRequest.newBuilder()
                                  .uri(URI.create(url))
                                  .header("Content-Type",  "application/json")
                                  .header("Accept",        "application/json")
                                  .header("Authorization", "Basic " + credentials)
                                  .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                                  .timeout(Duration.ofSeconds(30))
                                  .build(),
                          HttpResponse.BodyHandlers.ofString());

            if (resp.statusCode() != 200) {
                System.err.println("[SepApiService] HTTP " + resp.statusCode()
                        + " from " + url + "\n" + resp.body());
                return Collections.emptyList();
            }

            return parseItems(resp.body());

        } catch (Exception e) {
            System.err.println("[SepApiService] fetchTransactions failed: " + e.getMessage());
            return Collections.emptyList();
        }
    }

    public boolean isConfigured() {
        return API_KEY != null && !API_KEY.isBlank();
    }

    // ── Response parsing ──────────────────────────────────────────────────────

    private List<Map<String, Object>> parseItems(String responseBody) {
        try {
            JsonObject root = JsonParser.parseString(responseBody).getAsJsonObject();
            if (!root.has("listResult")) return Collections.emptyList();
            JsonObject listResult = root.getAsJsonObject("listResult");
            if (!listResult.has("items") || !listResult.get("items").isJsonArray())
                return Collections.emptyList();

            List<Map<String, Object>> rows = new ArrayList<>();
            for (JsonElement el : listResult.getAsJsonArray("items")) {
                if (el.isJsonObject()) rows.add(mapItem(el.getAsJsonObject()));
            }
            System.out.println("[SepApiService] loaded " + rows.size() + " transaction(s)");
            return rows;

        } catch (Exception e) {
            System.err.println("[SepApiService] response parse failed: " + e.getMessage());
            return Collections.emptyList();
        }
    }

    // ── Row mapping ───────────────────────────────────────────────────────────

    private Map<String, Object> mapItem(JsonObject item) {
        Map<String, Object> row = new LinkedHashMap<>();

        row.put("referenceNumber", str(item, "referenceNumber"));
        row.put("billingName",     str(item, "billingName"));

        // amount is a String in the API response ("10.00") — store as Double for sorting/aggregation
        double amount = 0;
        if (item.has("amount") && !item.get("amount").isJsonNull()) {
            try { amount = Double.parseDouble(item.get("amount").getAsString()); }
            catch (NumberFormatException ignored) {}
        }
        row.put("amount", amount);

        row.put("status",      str(item, "resultCode"));
        row.put("depositDate", str(item, "depositDate"));
        row.put("authCode",    str(item, "authCode"));
        row.put("email",       str(item, "billingEmail"));
        row.put("message",     str(item, "message"));
        row.put("transNumber", str(item, "transNumber"));

        // Flatten known customData fields
        String policyNumber = "";
        String insuredName  = "";
        if (item.has("customData") && item.get("customData").isJsonObject()) {
            JsonObject cd = item.getAsJsonObject("customData");
            policyNumber = str(cd, "policy_number");
            insuredName  = str(cd, "insured_name");
        }
        row.put("policyNumber", policyNumber);
        row.put("insuredName",  insuredName);

        return row;
    }

    private String str(JsonObject obj, String key) {
        if (!obj.has(key) || obj.get(key).isJsonNull()) return "";
        JsonElement el = obj.get(key);
        return el.isJsonPrimitive() ? el.getAsString() : "";
    }
}
