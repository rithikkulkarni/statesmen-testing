package com.statesmen.sep.bean;

import com.google.gson.*;
import com.statesmen.sep.data.AnalysisService;
import com.statesmen.sep.data.ChartFactory;
import com.statesmen.sep.data.DatasetService;
import com.statesmen.sep.model.ChatMessage;
import com.statesmen.sep.model.ChartResult;
import com.statesmen.sep.model.ColumnDef;
import com.statesmen.sep.model.Conversation;
import com.statesmen.sep.model.DatasetInfo;
import jakarta.faces.model.SelectItem;
import org.primefaces.PrimeFaces;
import jakarta.enterprise.context.SessionScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;

import java.io.Serializable;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Three-mode AI analyst:
 *
 *   "visual" — run SQL, display results as a chart
 *   "answer" — run SQL (or not), write a grounded natural-language answer
 *   "grid"   — change the data grid configuration (sort, filter, group, columns)
 *
 * A single "decision" call returns all three modes' instructions.
 * If needsQuery=true a second call writes the answer grounded in real SQL results.
 */
@Named
@SessionScoped
public class AiBean implements Serializable {

    // ── Unified system prompt ─────────────────────────────────────────────────
    private static final String UNIFIED_SYS = String.join("\n",
        "You are an AI analyst embedded in a data platform. Return only valid JSON.",
        "",
        "Activate one or more MODES based on the user's request:",
        "  \"visual\"  — run a SQL query and show results as a chart or visualization",
        "  \"answer\"  — give a data-grounded natural-language answer",
        "  \"grid\"    — change the data grid config (sort, filter, group, column visibility)",
        "",
        "Response JSON shape:",
        "{",
        "  \"modes\": [\"visual\",\"answer\"],",
        "  \"needsQuery\": true,",
        "  \"scope\": \"base_dataset\",",
        "  \"chartType\": null,",
        "  \"chartTitle\": null,",
        "  \"steps\": [...],",
        "  \"directAnswer\": null,",
        "  \"insights\": [],",
        "  \"recommendedActions\": [],",
        "  \"gridChange\": null",
        "}",
        "",
        "CHART TYPE RULES:",
        "- \"chartType\": set ONLY when the user explicitly names a chart type in their request.",
        "  Valid values: \"bar\", \"line\", \"pie\", \"doughnut\"",
        "  Examples: \"pie chart\" → \"pie\", \"bar graph\" → \"bar\", \"line chart\" → \"line\", \"donut chart\" → \"doughnut\"",
        "- If the user does NOT mention a specific chart type, leave chartType as null (auto-select).",
        "- ALWAYS honour the user's stated preference — never override it.",
        "",
        "- \"chartTitle\": required whenever \"visual\" is in modes.",
        "  Write a concise, descriptive title that says exactly what the chart shows.",
        "  Include: the metric(s) being measured, any active filters, the grouping/dimension, and time granularity if relevant.",
        "  Examples: \"Failed Payments by Carrier\", \"Total Revenue by Marketing Channel\",",
        "  \"Caramel Chocolate Sales by Revenue — Month over Month\", \"Pending vs Failed Amount by Status\"",
        "  Do NOT use vague titles like \"Over Time\", \"By Group\", or \"Chart\".",
        "",
        "MODE RULES:",
        "- \"visual\": user says chart/graph/visualize/plot, or data naturally fits a visual",
        "- \"answer\": factual questions — how many, which, what, compare, total, breakdown",
        "- \"grid\": user wants to change the table view — filter/sort/group/show/hide columns",
        "- Combine freely.  \"chart failed payments by carrier\" → [\"visual\",\"answer\"]",
        "- \"show only failed in the table and chart it\" → [\"visual\",\"answer\",\"grid\"]",
        "- Add \"visual\" automatically when SQL result would make a meaningful chart",
        "- Add \"answer\" whenever you provide a natural-language explanation",
        "",
        "gridChange — omit any key you are not changing:",
        "{ \"dataset\": \"payments\",",
        "  \"columns\": [\"status\", \"carrier\", \"amount\", \"date\"],",
        "  \"sort\": [{\"field\": \"amount\", \"direction\": \"desc\"}, {\"field\": \"status\", \"direction\": \"asc\"}] }",
        "Rules for gridChange:",
        "- \"sort\": controls how rows are ORDERED. Array in priority order — first entry = primary sort.",
        "  direction must be \"asc\" or \"desc\". An empty array [] clears all sorting.",
        "- \"columns\": controls which columns are VISIBLE and in what left-to-right display order.",
        "  List ALL field names you want shown, in the order you want them. Absent fields are hidden.",
        "  Only include \"columns\" when the user explicitly asks to show, hide, or rearrange columns.",
        "- \"dataset\": switch dataset (payments, adjustments, exceptions, candy).",
        "- Omit a key entirely if you are not changing it.",
        "",
        "CRITICAL — sort vs columns are completely independent:",
        "  'Sort by X ascending'        → only set \"sort\", NEVER touch \"columns\"",
        "  'Show only columns X and Y'  → only set \"columns\", NEVER touch \"sort\"",
        "  'Move column X to the front' → only set \"columns\", NEVER touch \"sort\"",
        "  Generating \"columns\" when the user only asks about sort direction DELETES all other columns.",
        "",
        "SCOPE: always \"base_dataset\" unless user explicitly says \"current view\" or \"visible rows\".",
        "",
        "SQL OPERATIONS (use in steps[]):",
        "filter  — {\"op\":\"filter\",\"conditions\":[{\"column\":\"c\",\"op\":\"eq|ne|gt|lt|gte|lte|in|oneOf|not_in|contains|between|is_null|not_null\",\"value\":...}],\"logic\":\"AND\"}",
        "groupBy — {\"op\":\"groupBy\",\"columns\":[\"c\"],\"aggregations\":[{\"column\":\"c\",\"fn\":\"SUM|AVG|COUNT|MIN|MAX\",\"alias\":\"name\"}],\"sort\":{\"column\":\"alias\",\"direction\":\"DESC\"},\"limit\":20}",
        "sort    — {\"op\":\"sort\",\"by\":[{\"column\":\"c\",\"direction\":\"DESC\"}],\"limit\":50}",
        "topN    — {\"op\":\"topN\",\"column\":\"c\",\"direction\":\"DESC\",\"n\":10}",
        "timeSeries — {\"op\":\"timeSeries\",\"dateColumn\":\"date\",\"granularity\":\"month\",\"aggregations\":[{\"column\":\"c\",\"fn\":\"SUM\",\"alias\":\"name\"}]}",
        "compare — {\"op\":\"compare\",\"segments\":[{\"label\":\"A\",\"conditions\":[...]},{\"label\":\"B\",\"conditions\":[...]}],\"metrics\":[{\"column\":\"c\",\"fn\":\"SUM\",\"alias\":\"name\"}]}",
        "",
        "RULES for steps:",
        "- Use ONLY column names from the dataset schema",
        "- ALWAYS filter before aggregating",
        "- Each step runs on the result of the previous step",
        "- \"label\" is a short present-continuous phrase shown while running"
    );

    @Inject private AppBean        appBean;
    @Inject private DatasetService  datasetService;
    @Inject private AnalysisService analysisService;
    @Inject private ChartFactory    chartFactory;

    private final List<ChatMessage>         messages = new ArrayList<>();
    private final List<Map<String, String>> history  = new ArrayList<>();

    // ── Conversation management ────────────────────────────────────────────
    private final List<Conversation> conversations      = new ArrayList<>();
    private       String             currentConvId      = null;
    private       String             selectedConvId     = null; // conversation dropdown binding
    private       String             selectedQuestionId = null; // question nav dropdown binding

    private String  promptInput   = "";
    private boolean busy          = false;
    private String  statusMessage = "Ask for analysis, a chart, or a table change.";

    private static final String GEMINI_API_KEY = System.getenv("GEMINI_API_KEY");
    private static final String GEMINI_MODEL   = System.getenv().getOrDefault("GEMINI_MODEL",    "gemini-2.5-flash-lite");
    private static final String OLLAMA_BASE    = System.getenv().getOrDefault("OLLAMA_BASE_URL", "http://127.0.0.1:11434");
    private static final String OLLAMA_MODEL   = System.getenv().getOrDefault("OLLAMA_MODEL",    "llama3.1:8b");
    private static final String AI_PROVIDER    = System.getenv().getOrDefault("AI_PROVIDER",     "gemini");

    public AiBean() { addWelcome(); }

    private void addWelcome() {
        messages.add(new ChatMessage("assistant", "Ask Analyst",
            "I can answer questions, create charts, or change the table view — sometimes all three at once.",
            "<p>I can answer questions, create charts, or change the table view — sometimes all three at once.</p>"
            + "<ul><li>\"Chart failed payments by carrier\"</li>"
            + "<li>\"What's the total pending amount?\"</li>"
            + "<li>\"Show only Paid records sorted by amount\"</li></ul>"));
    }

    public void newChat() {
        saveCurrentConversation();
        currentConvId     = null;
        selectedConvId    = null;
        selectedQuestionId = null;
        messages.clear();
        history.clear();
        addWelcome();
        statusMessage = "New conversation started.";
    }

    // ── Conversation management ───────────────────────────────────────────────

    /** Save the current messages into the conversations list (create or update). */
    private void saveCurrentConversation() {
        if (messages.stream().noneMatch(m -> "user".equals(m.getRole()))) return;

        if (currentConvId != null) {
            conversations.stream()
                .filter(c -> c.getId().equals(currentConvId))
                .findFirst()
                .ifPresent(c -> {
                    c.setMessages(copyMessages(messages));
                    autoName(c);
                });
        } else {
            Conversation conv = new Conversation(
                java.util.UUID.randomUUID().toString(),
                "New Chat",
                java.time.Instant.now().toString(),
                copyMessages(messages)
            );
            autoName(conv);
            conversations.add(0, conv); // most-recent first
            currentConvId  = conv.getId();
            selectedConvId = conv.getId();
        }
    }

    /** Auto-name conversation from the first user message (only if still "New Chat"). */
    private void autoName(Conversation conv) {
        if (!"New Chat".equals(conv.getName())) return;
        messages.stream()
            .filter(m -> "user".equals(m.getRole()))
            .findFirst()
            .ifPresent(m -> {
                String t = m.getRawContent().trim();
                conv.setName(t.length() > 52 ? t.substring(0, 52) + "…" : t);
            });
    }

    /** Shallow-copy messages (without chart results — those live in AppBean). */
    private List<ChatMessage> copyMessages(List<ChatMessage> src) {
        return src.stream().map(m -> {
            ChatMessage copy = new ChatMessage(m.getRole(), m.getTitle(),
                                               m.getRawContent(), m.getHtmlContent());
            copy.setSnapshotId(m.getSnapshotId());
            return copy;
        }).collect(Collectors.toList());
    }

    /** Called by the conversation dropdown; loads the chosen conversation. */
    public void onConversationChange() {
        if (selectedConvId == null || selectedConvId.equals(currentConvId)) return;
        saveCurrentConversation();
        conversations.stream()
            .filter(c -> c.getId().equals(selectedConvId))
            .findFirst()
            .ifPresent(conv -> {
                currentConvId = conv.getId();
                messages.clear();
                messages.addAll(copyMessages(conv.getMessages()));
                // Rebuild AI history from loaded messages
                history.clear();
                conv.getMessages().forEach(m -> {
                    if ("user".equals(m.getRole()) || "assistant".equals(m.getRole())) {
                        history.add(Map.of("role", m.getRole(), "content", m.getRawContent()));
                    }
                });
            });
        selectedQuestionId = null;
    }

    /** Called by the question-nav dropdown; scrolls chat to the chosen message. */
    public void onQuestionSelect() {
        if (selectedQuestionId == null || selectedQuestionId.isBlank()) return;
        PrimeFaces.current().executeScript("scrollToQuestion('" + selectedQuestionId + "')");
        selectedQuestionId = null; // reset dropdown to placeholder
    }

    /** SelectItems for the conversation dropdown. */
    public List<SelectItem> getConversationOptions() {
        return conversations.stream()
            .map(c -> new SelectItem(c.getId(), c.getName()))
            .collect(Collectors.toList());
    }

    /** SelectItems for the question-nav dropdown (user messages in current chat). */
    public List<SelectItem> getQuestionOptions() {
        List<SelectItem> opts = new ArrayList<>();
        opts.add(new SelectItem("", "Jump to question…"));
        for (int i = 0; i < messages.size(); i++) {
            ChatMessage m = messages.get(i);
            if ("user".equals(m.getRole())) {
                String raw = m.getRawContent() == null ? "" : m.getRawContent().trim();
                String label = raw.length() > 60 ? raw.substring(0, 60) + "…" : raw;
                opts.add(new SelectItem(String.valueOf(i), label));
            }
        }
        return opts;
    }

    public boolean isHasConversations() { return !conversations.isEmpty(); }
    public boolean isHasQuestions() {
        return messages.stream().anyMatch(m -> "user".equals(m.getRole()));
    }

    // ── Send ──────────────────────────────────────────────────────────────────

    public void send() {
        if (busy || promptInput == null || promptInput.trim().isEmpty()) return;
        String text = promptInput.trim();
        promptInput = "";
        messages.add(new ChatMessage("user", "You", text, "<p>" + esc(text) + "</p>"));
        history.add(Map.of("role", "user", "content", text));
        busy = true;
        statusMessage = "Analyzing…";
        try {
            processPrompt(text);
        } catch (Exception e) {
            String err = "AI error: " + e.getMessage();
            messages.add(new ChatMessage("assistant", "Error", err, "<p class=\"ai-error\">" + esc(err) + "</p>"));
            statusMessage = "AI call failed.";
        } finally {
            busy = false;
            saveCurrentConversation(); // persist after every exchange
        }
    }

    // ── Main pipeline ─────────────────────────────────────────────────────────

    private void processPrompt(String prompt) throws Exception {
        DatasetInfo ds     = datasetService.getDataset(appBean.getSelectedDataset());
        List<Map<String, String>> recent = recentHistory();

        // ── Stage 1: unified decision ─────────────────────────────────────────
        statusMessage = "Deciding what to do…";
        String decisionPrompt = buildDecisionPrompt(prompt, ds, appBean.getConfigJson(), recent);
        JsonObject decision   = callModelJson(decisionPrompt, UNIFIED_SYS);

        Set<String> modes = new LinkedHashSet<>();
        if (decision.has("modes") && decision.get("modes").isJsonArray()) {
            decision.getAsJsonArray("modes").forEach(m -> modes.add(m.getAsString()));
        }
        if (modes.isEmpty()) modes.add("answer");

        boolean hasVisual = modes.contains("visual");
        boolean hasAnswer = modes.contains("answer");
        boolean hasGrid   = modes.contains("grid");
        boolean needsQuery = decision.has("needsQuery") && decision.get("needsQuery").getAsBoolean()
                          && (hasVisual || hasAnswer);

        // ── Grid mode ─────────────────────────────────────────────────────────
        boolean gridApplied = false;
        if (hasGrid && decision.has("gridChange") && !decision.get("gridChange").isJsonNull()) {
            try {
                appBean.applyGridPatch(decision.getAsJsonObject("gridChange"));
                gridApplied = true;
            } catch (Exception e) { /* non-fatal */ }
        }

        // ── Visual / Answer modes — no SQL needed ─────────────────────────────
        if ((hasVisual || hasAnswer) && !needsQuery) {
            String direct   = decision.has("directAnswer") && !decision.get("directAnswer").isJsonNull()
                ? decision.get("directAnswer").getAsString() : "";
            if (direct.isBlank()) direct = hasGrid ? "Grid updated." : "Analysis complete.";
            ChatMessage msg = buildTextMessage(direct, jsonList(decision,"insights"),
                jsonList(decision,"recommendedActions"), gridApplied);
            messages.add(msg);
            history.add(Map.of("role", "assistant", "content", direct));
            statusMessage = "Done.";
            return;
        }

        // ── Visual / Answer modes — SQL needed ────────────────────────────────
        if ((hasVisual || hasAnswer) && needsQuery) {
            List<JsonObject> rawSteps = new ArrayList<>();
            if (decision.has("steps") && decision.get("steps").isJsonArray())
                decision.getAsJsonArray("steps").forEach(s -> rawSteps.add(s.getAsJsonObject()));

            List<JsonObject> steps = analysisService.reorderStepPlan(
                analysisService.pruneInvalidSteps(rawSteps, ds.getColumns()), ds.getColumns());

            if (steps.isEmpty()) {
                // Fallback: answer without SQL
                String direct = decision.has("directAnswer") && !decision.get("directAnswer").isJsonNull()
                    ? decision.get("directAnswer").getAsString() : "I could not build a query for that. Try rephrasing.";
                ChatMessage msg = buildTextMessage(direct, jsonList(decision,"insights"),
                    jsonList(decision,"recommendedActions"), gridApplied);
                messages.add(msg);
                history.add(Map.of("role", "assistant", "content", direct));
                statusMessage = "Done.";
                return;
            }

            String scope = decision.has("scope") ? decision.get("scope").getAsString() : "base_dataset";

            analysisService.ensureTable(ds.getId(), ds.getRows());
            List<String> finalColumns = new ArrayList<>();
            List<Map<String, Object>> finalRows = new ArrayList<>();

            // Run the step pipeline — if it fails, ask the AI to repair the steps and retry once
            try {
                SqlResult sr = runSteps(steps, ds.getId());
                finalColumns = sr.columns;
                finalRows    = sr.rows;
            } catch (Exception sqlError) {
                statusMessage = "Query failed — asking AI to repair the steps…";
                List<JsonObject> repairedSteps = repairStepsWithAI(steps, sqlError.getMessage(), ds);
                if (repairedSteps != null && !repairedSteps.isEmpty()) {
                    try {
                        SqlResult sr = runSteps(repairedSteps, ds.getId());
                        finalColumns = sr.columns;
                        finalRows    = sr.rows;
                        steps = repairedSteps; // use repaired steps for summary/facts
                    } catch (Exception retryError) {
                        // Both attempts failed — fall through with empty results; answer-only mode below
                        System.err.println("[AiBean] Retry after repair also failed: " + retryError.getMessage());
                    }
                }
            }

            // Update DataTable with query results when visual mode is active
            if (hasVisual && !finalRows.isEmpty()) {
                appBean.loadAnalysisResults(finalColumns, finalRows);
            }

            // Build chart — honour explicit type the user requested
            String requestedChartType = decision.has("chartType") && !decision.get("chartType").isJsonNull()
                ? decision.get("chartType").getAsString() : null;
            ChartResult chart = (hasVisual || !finalRows.isEmpty())
                ? chartFactory.create(finalColumns, finalRows, requestedChartType) : null;

            // ── Stage 2: generate answer from SQL results ─────────────────────
            String answer   = "";
            List<String> insights = new ArrayList<>();
            List<String> actions  = new ArrayList<>();

            if (hasAnswer) {
                statusMessage = "Summarizing findings…";
                Map<String, Object> facts = analysisService.computeSummaryFacts(finalColumns, finalRows, steps);
                String answerPrompt = buildFinalAnswerPrompt(ds, prompt, finalColumns, finalRows, recent, scope, facts, steps);
                JsonObject answerJson = callModelJson(answerPrompt, null);
                answer   = answerJson.has("answer") ? answerJson.get("answer").getAsString() : "Analysis complete.";
                insights = jsonList(answerJson, "insights");
                actions  = jsonList(answerJson, "recommendedActions");
            } else {
                answer = "Here are the results" + (chart != null ? " as a chart" : "") + ".";
            }

            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("scope", scope);
            meta.put("resultRowCount", finalRows.size());

            // Push chart JSON to the dedicated chart panel in AppBean
            if (chart != null) {
                String aiTitle = decision.has("chartTitle") && !decision.get("chartTitle").isJsonNull()
                    ? decision.get("chartTitle").getAsString().trim() : null;
                String chartTitle = (aiTitle != null && !aiTitle.isBlank())
                    ? aiTitle : buildChartTitle(finalColumns, steps);
                appBean.storeChartJson(chart.getChartJson(), chartTitle);
            }

            // Store snapshot so the user can restore this view from the chat message
            String snapshotId = null;
            if (!finalRows.isEmpty()) {
                snapshotId = java.util.UUID.randomUUID().toString();
                appBean.storeQuerySnapshot(snapshotId, finalColumns, finalRows);
            }

            ChatMessage msg = buildAnalysisMessage(answer, insights, actions,
                !finalRows.isEmpty() ? meta : null,
                !finalColumns.isEmpty() ? finalColumns : null,
                gridApplied);

            if (snapshotId != null) msg.setSnapshotId(snapshotId);
            messages.add(msg);
            history.add(Map.of("role", "assistant", "content", answer));
            statusMessage = "Done.";
            return;
        }

        // ── Grid-only mode (no visual/answer) ─────────────────────────────────
        if (hasGrid) {
            String msg = gridApplied ? "Grid configuration updated." : "Could not parse the grid change.";
            messages.add(new ChatMessage("assistant", "Ask Analyst", msg,
                "<p>" + esc(msg) + "</p>"
                + (gridApplied ? "<p class=\"config-applied\">&#10003; Table updated — see the grid.</p>" : "")));
            history.add(Map.of("role", "assistant", "content", msg));
            statusMessage = "Done.";
        }
    }

    // ── Prompt builders ───────────────────────────────────────────────────────

    /**
     * Unified decision prompt — combines mode detection, SQL step planning, and
     * grid config generation in one call. Equivalent to both buildStructuredQueryPrompt
     * and buildModelPrompt from the original vite.config.js, merged.
     */
    private String buildDecisionPrompt(String prompt, DatasetInfo ds, String configJson,
                                        List<Map<String, String>> recent) {
        List<ColumnDef> cols = ds.getColumns();
        String allFields  = cols.stream().map(ColumnDef::getField).collect(Collectors.joining(", "));
        String numFields  = cols.stream().filter(ColumnDef::isNumeric).map(ColumnDef::getField).collect(Collectors.joining(", "));
        String textFields = cols.stream().filter(c -> !c.isNumeric()).map(ColumnDef::getField).collect(Collectors.joining(", "));
        String sampleJson = new Gson().toJson(ds.getRows().stream().limit(8).collect(Collectors.toList()));
        String histBlock  = recent.isEmpty() ? "" :
            "Prior conversation:\n" + recent.stream()
                .map(m -> ("user".equals(m.get("role")) ? "User" : "Assistant") + ": " + m.get("content"))
                .collect(Collectors.joining("\n")) + "\n\n";

        return """
            %sUser request: %s

            Dataset: %s (%d rows)
            All columns: %s
            Numeric: %s
            Text/categorical: %s
            Current config: %s
            Datasets available: payments, adjustments, exceptions, candy

            Sample rows (real values):
            %s

            %s
            """.formatted(
                histBlock, prompt,
                ds.getLabel(), ds.getRows().size(),
                allFields, numFields, textFields,
                configJson,
                sampleJson,
                buildFewShotExamples(ds.getId())
            );
    }

    /** Port of buildFewShotExamples — unified examples covering all three modes. */
    private String buildFewShotExamples(String datasetId) {
        boolean isPayment = List.of("payments","adjustments","exceptions").contains(datasetId);
        boolean isCandy   = "candy".equals(datasetId);
        StringBuilder sb  = new StringBuilder("EXAMPLES:\n");

        if (isPayment) {
            sb.append("""
                Q: "Chart failed payments by carrier"
                A: {"modes":["visual","answer"],"needsQuery":true,"chartType":null,"chartTitle":"Failed Payments by Carrier — Total Exposure","scope":"base_dataset","steps":[{"label":"Filtering to failed","op":"filter","conditions":[{"column":"status","op":"eq","value":"Failed"}]},{"label":"Ranking carriers by exposure","op":"groupBy","columns":["carrier"],"aggregations":[{"column":"amount","fn":"SUM","alias":"failedExposure"},{"column":"*","fn":"COUNT","alias":"count"}],"sort":{"column":"failedExposure","direction":"DESC"}}],"gridChange":null}

                Q: "Sort the grid by amount, highest first"
                A: {"modes":["grid"],"needsQuery":false,"chartType":null,"chartTitle":null,"gridChange":{"sort":[{"field":"amount","direction":"desc"}]}}

                Q: "Sort by carrier then by amount descending"
                A: {"modes":["grid"],"needsQuery":false,"chartType":null,"chartTitle":null,"gridChange":{"sort":[{"field":"carrier","direction":"asc"},{"field":"amount","direction":"desc"}]}}

                Q: "Move status to be the first column"
                A: {"modes":["grid"],"needsQuery":false,"chartType":null,"chartTitle":null,"gridChange":{"columns":["status","carrier","policyNumber","claimNumber","amount","date"]}}

                Q: "Hide the date and policy number columns"
                A: {"modes":["grid"],"needsQuery":false,"chartType":null,"chartTitle":null,"gridChange":{"columns":["status","carrier","claimNumber","amount"]}}

                Q: "Clear all sorting"
                A: {"modes":["grid"],"needsQuery":false,"chartType":null,"chartTitle":null,"gridChange":{"sort":[]}}

                Q: "How many payments are there by status?"
                A: {"modes":["visual","answer"],"needsQuery":true,"chartType":null,"chartTitle":"Payment Count by Status","scope":"base_dataset","steps":[{"label":"Counting by status","op":"groupBy","columns":["status"],"aggregations":[{"column":"*","fn":"COUNT","alias":"count"},{"column":"amount","fn":"SUM","alias":"totalAmount"}],"sort":{"column":"count","direction":"DESC"}}],"gridChange":null}

                Q: "What should we prioritize?"
                A: {"modes":["answer"],"needsQuery":false,"chartType":null,"chartTitle":null,"directAnswer":"Prioritize high-value failed and pending payments first, grouped by carrier to assign ownership.","insights":["Failed payments represent immediate recovery risk."],"recommendedActions":["Filter to Failed and Pending, sort by amount descending."],"gridChange":null}

                Q: "Give me a pie chart of payments by status"
                A: {"modes":["visual","answer"],"needsQuery":true,"chartType":"pie","chartTitle":"Payment Count by Status","scope":"base_dataset","steps":[{"label":"Counting by status","op":"groupBy","columns":["status"],"aggregations":[{"column":"*","fn":"COUNT","alias":"count"},{"column":"amount","fn":"SUM","alias":"totalAmount"}],"sort":{"column":"count","direction":"DESC"}}],"gridChange":null}

                Q: "Bar chart of total amount by carrier"
                A: {"modes":["visual","answer"],"needsQuery":true,"chartType":"bar","chartTitle":"Total Payment Amount by Carrier","scope":"base_dataset","steps":[{"label":"Summing by carrier","op":"groupBy","columns":["carrier"],"aggregations":[{"column":"amount","fn":"SUM","alias":"totalAmount"}],"sort":{"column":"totalAmount","direction":"DESC"}}],"gridChange":null}

                Q: "Show a line chart of payments over time"
                A: {"modes":["visual","answer"],"needsQuery":true,"chartType":"line","chartTitle":"Total Payment Amount — Month over Month","scope":"base_dataset","steps":[{"label":"Payments over time","op":"timeSeries","dateColumn":"date","granularity":"month","aggregations":[{"column":"amount","fn":"SUM","alias":"totalAmount"}]}],"gridChange":null}
                """);
        }

        if (isCandy) {
            sb.append("""
                Q: "Chart revenue by marketing channel"
                A: {"modes":["visual","answer"],"needsQuery":true,"chartType":null,"chartTitle":"Total Revenue by Marketing Channel","scope":"base_dataset","steps":[{"label":"Revenue by channel","op":"groupBy","columns":["marketingChannel"],"aggregations":[{"column":"total","fn":"SUM","alias":"totalRevenue"},{"column":"*","fn":"COUNT","alias":"transactions"}],"sort":{"column":"totalRevenue","direction":"DESC"}}],"gridChange":null}

                Q: "Which products sell the most? Also filter the grid to show Chocolate only"
                A: {"modes":["visual","answer","grid"],"needsQuery":true,"chartType":null,"chartTitle":"Top Products by Units Sold (Chocolate)","scope":"base_dataset","steps":[{"label":"Ranking products by quantity","op":"groupBy","columns":["product","category"],"aggregations":[{"column":"quantity","fn":"SUM","alias":"totalQty"},{"column":"total","fn":"SUM","alias":"revenue"}],"sort":{"column":"totalQty","direction":"DESC"},"limit":15}],"gridChange":{"filters":{"category":{"operator":"equals","value":"Chocolate"}}}}
                """);
        }

        return sb.toString();
    }

    /** Port of buildFinalAnswerPrompt — answer grounded in real SQL results. */
    private String buildFinalAnswerPrompt(DatasetInfo ds, String prompt,
                                           List<String> columns, List<Map<String, Object>> rows,
                                           List<Map<String, String>> chatHistory, String scope,
                                           Map<String, Object> facts, List<JsonObject> steps) {
        String histBlock = chatHistory.isEmpty() ? "" :
            "Prior conversation:\n" + chatHistory.stream()
                .map(m -> ("user".equals(m.get("role")) ? "User" : "Assistant") + ": " + m.get("content"))
                .collect(Collectors.joining("\n")) + "\n\n";
        String scopeLabel = switch (scope) {
            case "current_view" -> "the current visible grid view";
            default             -> "the full base dataset";
        };

        return """
            You are a data analyst. Write a concise answer grounded strictly in the query results below.

            %sUser question: %s
            Dataset: %s, scope: %s

            Query executed:
            %s

            Verified facts:
            %s

            Result columns: %s
            Result rows (up to 50):
            %s

            Return JSON only:
            {"answer":"2-4 sentence answer","insights":["finding 1"],"recommendedActions":["next step"]}

            Rules: ground every number in result rows. 1-3 insights max.
            """.formatted(
                histBlock, prompt, ds.getLabel(), scopeLabel,
                describeSteps(steps),
                new GsonBuilder().setPrettyPrinting().create().toJson(facts),
                new Gson().toJson(columns),
                new Gson().toJson(rows.subList(0, Math.min(50, rows.size())))
            );
    }

    // ── SQL execution helpers ─────────────────────────────────────────────────

    private static class SqlResult {
        final List<String> columns;
        final List<Map<String, Object>> rows;
        SqlResult(List<String> c, List<Map<String, Object>> r) { columns = c; rows = r; }
    }

    /** Execute all steps in sequence; each step's output is the next step's input table. */
    private SqlResult runSteps(List<JsonObject> steps, String baseTableId) throws Exception {
        String currentSource = baseTableId;
        List<String> finalColumns = new ArrayList<>();
        List<Map<String, Object>> finalRows = new ArrayList<>();

        for (int i = 0; i < steps.size(); i++) {
            JsonObject step = steps.get(i);
            statusMessage = (step.has("label") ? step.get("label").getAsString() : "Processing") + "…";
            String sql = analysisService.buildStepSql(step, "\"" + currentSource + "\"");
            List<Map<String, Object>> stepRows = analysisService.executeQuery(sql);
            finalColumns = stepRows.isEmpty() ? new ArrayList<>() : new ArrayList<>(stepRows.get(0).keySet());
            finalRows    = stepRows;
            if (i < steps.size() - 1 && !stepRows.isEmpty()) {
                String vid = "__step_" + i;
                analysisService.ensureTable(vid, stepRows);
                currentSource = vid;
            }
        }
        return new SqlResult(finalColumns, finalRows);
    }

    /**
     * Ask the AI to rewrite failed steps using only valid operators.
     * Returns the corrected steps list, or null if repair itself fails.
     */
    private List<JsonObject> repairStepsWithAI(List<JsonObject> failedSteps, String errorMessage, DatasetInfo ds) {
        try {
            String schema = ds.getColumns().stream()
                .map(c -> c.getField() + "(" + (c.isNumeric() ? "number" : "string") + ")")
                .collect(Collectors.joining(", "));

            String repairPrompt = """
                A SQL step pipeline failed with this error:
                  %s

                Failed steps:
                %s

                Dataset schema: %s

                Valid condition operators (use ONLY these):
                  eq, ne, gt, lt, gte, lte, in, not_in, contains, starts_with, ends_with, between, is_null, not_null

                Return a corrected version as JSON: {"steps": [...]}
                Keep the same logic intent but fix any invalid operators or structure.
                """.formatted(errorMessage, new Gson().toJson(failedSteps), schema);

            JsonObject fix = callModelJson(repairPrompt, "Return only valid JSON with a 'steps' array.");
            if (fix.has("steps") && fix.get("steps").isJsonArray()) {
                List<JsonObject> repaired = new ArrayList<>();
                fix.getAsJsonArray("steps").forEach(s -> repaired.add(s.getAsJsonObject()));
                return repaired;
            }
        } catch (Exception e) {
            System.err.println("[AiBean] repairStepsWithAI failed: " + e.getMessage());
        }
        return null;
    }

    private String buildChartTitle(List<String> columns, List<JsonObject> steps) {
        // Derive a short title from the last groupBy step or fall back to column names
        for (int i = steps.size() - 1; i >= 0; i--) {
            JsonObject s = steps.get(i);
            if ("groupBy".equals(s.has("op") ? s.get("op").getAsString() : "")) {
                List<String> gc = new ArrayList<>();
                if (s.has("columns")) s.getAsJsonArray("columns").forEach(c -> gc.add(
                    c.getAsString().replaceAll("([A-Z])", " $1").trim()));
                if (!gc.isEmpty()) return "By " + String.join(" & ", gc);
            }
            if ("timeSeries".equals(s.has("op") ? s.get("op").getAsString() : "")) {
                return "Over Time";
            }
        }
        // Fallback: use column names
        return columns.stream().limit(2)
            .map(c -> c.replaceAll("([A-Z])", " $1").trim())
            .collect(Collectors.joining(" vs "));
    }

    private String describeSteps(List<JsonObject> steps) {
        List<String> lines = new ArrayList<>();
        boolean hasFilter = steps.stream().anyMatch(s -> "filter".equals(s.has("op") ? s.get("op").getAsString() : ""));
        for (int i = 0; i < steps.size(); i++) {
            JsonObject s = steps.get(i);
            String op = s.has("op") ? s.get("op").getAsString() : "?";
            lines.add(switch (op) {
                case "filter" -> {
                    List<String> conds = new ArrayList<>();
                    if (s.has("conditions")) s.getAsJsonArray("conditions").forEach(c -> {
                        JsonObject co = c.getAsJsonObject();
                        conds.add(co.has("column") ? co.get("column").getAsString() : "?" + " "
                            + (co.has("op") ? co.get("op").getAsString() : "?") + " "
                            + (co.has("value") ? co.get("value").toString() : "?"));
                    });
                    yield "Step " + (i+1) + ": FILTER — " + String.join(" AND ", conds);
                }
                case "groupBy" -> {
                    List<String> gc = new ArrayList<>();
                    if (s.has("columns")) s.getAsJsonArray("columns").forEach(c -> gc.add(c.getAsString()));
                    List<String> ag = new ArrayList<>();
                    if (s.has("aggregations")) s.getAsJsonArray("aggregations").forEach(a -> {
                        JsonObject ao = a.getAsJsonObject();
                        ag.add((ao.has("fn") ? ao.get("fn").getAsString() : "?") + "("
                            + (ao.has("column") ? ao.get("column").getAsString() : "?") + ") as "
                            + (ao.has("alias") ? ao.get("alias").getAsString() : "?"));
                    });
                    yield "Step " + (i+1) + ": GROUP BY " + String.join(", ", gc) + " → " + String.join(", ", ag);
                }
                default -> "Step " + (i+1) + ": " + op;
            });
        }
        if (!hasFilter) lines.add("NOTE: No FILTER — aggregations cover all rows.");
        return String.join("\n", lines);
    }

    // ── AI provider calls ─────────────────────────────────────────────────────

    private JsonObject callModelJson(String userPrompt, String systemPrompt) throws Exception {
        String raw = "ollama".equalsIgnoreCase(AI_PROVIDER)
            ? callOllama(userPrompt, systemPrompt)
            : callGemini(userPrompt, systemPrompt);
        return extractJson(raw);
    }

    private String callGemini(String userPrompt, String systemPrompt) throws Exception {
        if (GEMINI_API_KEY == null || GEMINI_API_KEY.isBlank())
            throw new IllegalStateException("GEMINI_API_KEY environment variable is not set.");

        JsonObject body = new JsonObject();
        if (systemPrompt != null) {
            JsonObject sys = new JsonObject(); JsonArray sp = new JsonArray();
            JsonObject spart = new JsonObject(); spart.addProperty("text", systemPrompt);
            sp.add(spart); sys.add("parts", sp); body.add("systemInstruction", sys);
        }

        JsonObject content = new JsonObject(); content.addProperty("role", "user");
        JsonArray parts = new JsonArray(); JsonObject part = new JsonObject();
        part.addProperty("text", userPrompt); parts.add(part); content.add("parts", parts);
        JsonArray contents = new JsonArray(); contents.add(content);
        body.add("contents", contents);

        JsonObject gen = new JsonObject();
        gen.addProperty("temperature", 0.1);
        gen.addProperty("responseMimeType", "application/json");
        body.add("generationConfig", gen);

        HttpResponse<String> resp = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build()
            .send(HttpRequest.newBuilder()
                .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/models/"
                    + GEMINI_MODEL + ":generateContent?key=" + GEMINI_API_KEY))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .timeout(Duration.ofSeconds(90)).build(),
                HttpResponse.BodyHandlers.ofString());

        if (resp.statusCode() != 200) throw new RuntimeException("Gemini " + resp.statusCode() + ": " + resp.body());
        return JsonParser.parseString(resp.body()).getAsJsonObject()
            .getAsJsonArray("candidates").get(0).getAsJsonObject()
            .getAsJsonObject("content").getAsJsonArray("parts")
            .get(0).getAsJsonObject().get("text").getAsString();
    }

    private String callOllama(String userPrompt, String systemPrompt) throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("model",  OLLAMA_MODEL);
        body.addProperty("system", systemPrompt != null ? systemPrompt : "Return only valid JSON. No prose or markdown fences.");
        body.addProperty("prompt", userPrompt);
        body.addProperty("stream", false);
        body.addProperty("format", "json");
        JsonObject opts = new JsonObject(); opts.addProperty("temperature", 0.1);
        body.add("options", opts);

        HttpResponse<String> resp = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build()
            .send(HttpRequest.newBuilder()
                .uri(URI.create(OLLAMA_BASE + "/api/generate"))
                .header("Content-Type","application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .timeout(Duration.ofSeconds(120)).build(),
                HttpResponse.BodyHandlers.ofString());

        if (resp.statusCode() != 200) throw new RuntimeException("Ollama " + resp.statusCode() + ": " + resp.body());
        return JsonParser.parseString(resp.body()).getAsJsonObject().get("response").getAsString();
    }

    // ── Message builders ──────────────────────────────────────────────────────

    private ChatMessage buildAnalysisMessage(String answer, List<String> insights, List<String> actions,
                                              Map<String, Object> queryMeta, List<String> queryColumns,
                                              boolean gridApplied) {
        StringBuilder html = new StringBuilder("<p class=\"analysis-answer\">").append(esc(answer)).append("</p>");
        htmlList(html, insights, "Key Insights");
        htmlList(html, actions,  "Recommended Actions");
        if (queryMeta != null) {
            html.append("<div class=\"answerMeta\">");
            if (queryMeta.containsKey("resultRowCount"))
                html.append("<span class=\"answerMetaChip\">").append(queryMeta.get("resultRowCount")).append(" result rows</span>");
            String scope = String.valueOf(queryMeta.getOrDefault("scope",""));
            if ("current_view".equals(scope)) html.append("<span class=\"answerMetaChip\">Current view</span>");
            html.append("</div>");
        }
        if (queryColumns != null && !queryColumns.isEmpty())
            html.append("<p class=\"config-applied\">&#9998; Grid shows query results — click Restore View to go back.</p>");
        if (gridApplied)
            html.append("<p class=\"config-applied\">&#10003; Grid configuration also updated.</p>");
        return new ChatMessage("assistant", "Ask Analyst", answer, html.toString());
    }

    private ChatMessage buildTextMessage(String answer, List<String> insights, List<String> actions,
                                          boolean gridApplied) {
        StringBuilder html = new StringBuilder("<p>").append(esc(answer)).append("</p>");
        htmlList(html, insights, "Insights");
        htmlList(html, actions,  "Recommended Actions");
        if (gridApplied) html.append("<p class=\"config-applied\">&#10003; Grid also updated.</p>");
        return new ChatMessage("assistant", "Ask Analyst", answer, html.toString());
    }

    private void htmlList(StringBuilder sb, List<String> items, String heading) {
        if (items == null || items.isEmpty()) return;
        sb.append("<div class=\"analysis-section\"><h4>").append(heading).append("</h4><ul>");
        items.forEach(i -> sb.append("<li>").append(esc(i)).append("</li>"));
        sb.append("</ul></div>");
    }

    private List<String> jsonList(JsonObject obj, String key) {
        List<String> out = new ArrayList<>();
        if (obj.has(key) && obj.get(key).isJsonArray())
            obj.getAsJsonArray(key).forEach(e -> { if (e.isJsonPrimitive()) out.add(e.getAsString()); });
        return out;
    }

    private List<Map<String, String>> recentHistory() {
        int start = Math.max(0, history.size() - 8);
        return history.subList(start, history.size());
    }

    private JsonObject extractJson(String text) {
        if (text == null) return new JsonObject();
        String t = text.trim();
        int start = t.indexOf('{'); int end = t.lastIndexOf('}');
        if (start < 0 || end <= start) return new JsonObject();
        try { return JsonParser.parseString(t.substring(start, end + 1)).getAsJsonObject(); }
        catch (Exception e) { return new JsonObject(); }
    }

    private String esc(String t) {
        if (t == null) return "";
        return t.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;");
    }

    // ── Getters / setters ─────────────────────────────────────────────────────

    public List<ChatMessage> getMessages()      { return messages; }
    public String  getPromptInput()             { return promptInput; }
    public void    setPromptInput(String v)     { this.promptInput = v; }
    public boolean isBusy()                     { return busy; }
    public String  getStatusMessage()            { return statusMessage; }
    public String  getSelectedConvId()           { return selectedConvId; }
    public void    setSelectedConvId(String v)   { this.selectedConvId = v; }
    public String  getSelectedQuestionId()       { return selectedQuestionId; }
    public void    setSelectedQuestionId(String v){ this.selectedQuestionId = v; }
}
