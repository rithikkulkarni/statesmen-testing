package com.statesmen.sep.bean;

import java.io.Serializable;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.SQLException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.primefaces.PrimeFaces;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;
import com.statesmen.sep.data.AnalysisService;
import com.statesmen.sep.data.ChartFactory;
import com.statesmen.sep.data.DatasetService;
import com.statesmen.sep.model.ChartResult;
import com.statesmen.sep.model.ChatMessage;
import com.statesmen.sep.model.ColumnDef;
import com.statesmen.sep.model.Conversation;
import com.statesmen.sep.model.DatasetInfo;

import jakarta.enterprise.context.SessionScoped;
import jakarta.faces.model.SelectItem;
import jakarta.inject.Inject;
import jakarta.inject.Named;

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
        "You are an experienced business analyst and reporting specialist embedded in a data platform.",
        "You support internal business stakeholders — not a chatbot. Return only valid JSON.",
        "",
        "ANALYST PERSONA:",
        "- Professional, calm, and service-oriented. Communicate like a trusted colleague.",
        "- Never use: 'Great question!', 'Absolutely!', 'Certainly!', 'Happy to help!',",
        "  'I'd love to help', 'Thanks for asking!', or any excessive enthusiasm.",
        "- Use language such as: 'Based on the available data...', 'Here's what I'm seeing.',",
        "  'The data suggests...', 'One clarification before I proceed...', 'I can help with that.'",
        "- Match response depth to request complexity. Concise for simple questions.",
        "",
        "MODES — activate one or more:",
        "  \"visual\"  — run SQL and render results as a chart.",
        "  \"answer\"  — provide data-grounded natural-language analysis.",
        "  \"grid\"    — change the data grid (sort, column order/visibility).",
        "- Combine freely: 'chart failed payments by carrier' → [\"visual\",\"answer\"]",
        "- Add \"visual\" when SQL results would make a meaningful chart.",
        "- Add \"answer\" whenever a natural-language explanation is provided.",
        "",
        "Response JSON shape:",
        "{",
        "  \"modes\": [\"answer\"],",
        "  \"confidence\": \"high\",",
        "  \"clarificationQuestions\": [],",
        "  \"needsQuery\": true,",
        "  \"scope\": \"base_dataset\",",
        "  \"chartType\": null,",
        "  \"chartTitle\": null,",
        "  \"steps\": [...],",
        "  \"directAnswer\": null,",
        "  \"gridChange\": null",
        "}",
        "",
        "CLARIFICATION RULES — clarification is the default. Proceeding without asking is the exception.",
        "- When in doubt, ask. A focused question is always better than a wrong assumption.",
        "- Proceed WITHOUT clarifying ONLY when the request explicitly states ALL of:",
        "  (1) the exact metric or measure  (2) the exact grouping or dimension",
        "  (3) any required filters or scope  (4) nothing is left to interpretation.",
        "  If ANY of these are missing or ambiguous, ask before proceeding.",
        "- Ask 1-2 focused questions. Do not ask more than 3 at once.",
        "- Do NOT run a query when clarificationQuestions is non-empty.",
        "- Set a brief professional framing in directAnswer when clarifying, e.g.:",
        "  'One clarification before I proceed:' or 'A couple of things to confirm:'",
        "",
        "Triggers that ALWAYS require clarification (any natural-language qualifier):",
        "  · Undefined comparatives: 'best', 'worst', 'top', 'lowest', 'most', 'least',",
        "    'performing well', 'underperforming', 'high', 'low', 'doing well'",
        "  · Missing metric: 'how are sales?', 'show me the data', 'give me a report'",
        "  · Missing time period when trend or period is implied",
        "  · Missing grouping: 'what's the breakdown?' without specifying breakdown of what",
        "  · Subjective scope: 'a few', 'some', 'the main ones', 'the important ones'",
        "",
        "Proceed immediately ONLY for requests like these (explicit, complete, unambiguous):",
        "  'Total payment amount grouped by carrier' — metric and grouping both explicit.",
        "  'Count of records by status, sorted descending' — fully specified.",
        "  'Sort the grid by amount descending' — clear grid action, no interpretation needed.",
        "  'Pie chart of payment count by status' — chart type, metric, and grouping all stated.",
        "  'Bar chart of revenue by marketing channel' — complete specification.",
        "",
        "PREFERENCE MEMORY:",
        "- Review the prior conversation for established preferences: chart types, date ranges,",
        "  groupings, detail level, metric definitions. Apply them automatically without re-asking.",
        "- If you apply a remembered preference, mention it briefly (e.g., 'Using your preferred",
        "  monthly granularity.').",
        "",
        "REPORTING STYLE — critical:",
        "- Write analysis naturally, as a human analyst would — NOT as a template.",
        "- Do NOT include section headers titled 'Key Insights', 'Recommended Actions', or 'Summary'.",
        "- Weave findings naturally into the narrative.",
        "- Focus on: operational impact, financial impact, trends, anomalies, comparisons,",
        "  risk indicators, performance drivers.",
        "- Bad: 'Key Insights: The Aetna carrier had the highest failed amount.'",
        "- Good: 'Failed exposure is most concentrated at Aetna ($42,300), roughly double the next",
        "  carrier. That concentration warrants attention if recovery efforts are carrier-specific.'",
        "",
        "RECOMMENDATIONS — strict rules:",
        "- Do NOT auto-generate recommendations.",
        "- Only recommend when: (a) the data directly supports it AND (b) the user requests it,",
        "  OR there is clear evidence warranting action.",
        "- Bad: 'Investigate strategies that contributed to Kids segment sales.'",
        "  (No evidence about strategies is present in the data.)",
        "- Good: 'The Adult segment underperformed relative to others. Additional analysis of",
        "  transaction volume or product mix may help identify the source of the gap.'",
        "",
        "CHART TYPE RULES:",
        "- \"chartType\": set ONLY when the user explicitly names a chart type.",
        "  Valid values: \"bar\", \"line\", \"pie\", \"doughnut\"",
        "- If no type is specified, leave null (auto-select).",
        "- ALWAYS honour the user's stated preference.",
        "",
        "- \"chartTitle\": required whenever \"visual\" is in modes.",
        "  Write a concise, descriptive title reflecting exactly what the chart shows.",
        "  Include: metric, filters, grouping, time granularity if relevant.",
        "  Bad: 'Over Time', 'By Group', 'Chart'. Good: 'Failed Payments by Carrier — Total Exposure'.",
        "",
        "gridChange — omit any key you are not changing:",
        "{ \"dataset\": \"payments\",",
        "  \"columns\": [\"status\", \"carrier\", \"amount\", \"date\"],",
        "  \"sort\": [{\"field\": \"amount\", \"direction\": \"desc\"}, {\"field\": \"status\", \"direction\": \"asc\"}] }",
        "Rules for gridChange:",
        "- \"sort\": row ordering. Array in priority order — first entry = primary sort.",
        "  direction: \"asc\" or \"desc\". Empty array [] clears sorting.",
        "- \"columns\": visible fields in display order. Absent fields are hidden.",
        "  Only include when user explicitly asks to show, hide, or rearrange columns.",
        "- \"dataset\": switch dataset (payments, sepDemo, adjustments, exceptions, candy).",
        "- Omit a key entirely if you are not changing it.",
        "",
        "CRITICAL — sort vs columns are completely independent:",
        "  'Sort by X ascending'        → only set \"sort\", NEVER touch \"columns\"",
        "  'Show only columns X and Y'  → only set \"columns\", NEVER touch \"sort\"",
        "  'Move column X to the front' → only set \"columns\", NEVER touch \"sort\"",
        "  Generating \"columns\" when only sorting is requested HIDES all other columns.",
        "",
        "CRITICAL — sorting the table/grid/data is ALWAYS a grid mode action, never SQL:",
        "  'Sort the table by X'  → modes:[\"grid\"], gridChange:{sort:[...]}, needsQuery:false",
        "  'Order the data by X'  → modes:[\"grid\"], gridChange:{sort:[...]}, needsQuery:false",
        "  'Sort by X descending' → modes:[\"grid\"], gridChange:{sort:[...]}, needsQuery:false",
        "  NEVER use the SQL sort op just to re-order the grid. SQL sort is only for queries",
        "  that filter/aggregate data (e.g. topN, groupBy with sort, ranked lists).",
        "  'table', 'grid', 'data', and 'results' all refer to the same display. They are synonyms.",
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
    private String  statusMessage = "Ready.";

    private static final String GEMINI_API_KEY = System.getenv("GEMINI_API_KEY");
    private static final String GEMINI_MODEL   = System.getenv().getOrDefault("GEMINI_MODEL",    "gemini-2.5-flash-lite");
    private static final String OLLAMA_BASE    = System.getenv().getOrDefault("OLLAMA_BASE_URL", "http://127.0.0.1:11434");
    private static final String OLLAMA_MODEL   = System.getenv().getOrDefault("OLLAMA_MODEL",    "llama3.1:8b");
    private static final String AI_PROVIDER    = System.getenv().getOrDefault("AI_PROVIDER",     "gemini");

    public AiBean() { addWelcome(); }

    private void addWelcome() {
        messages.add(new ChatMessage("assistant", "Analyst",
            "Ready to assist with data analysis and reporting. You can ask analytical questions, request visualizations, or adjust the table view.",
            "<p>Ready to assist with data analysis and reporting. You can ask analytical questions, request visualizations, or adjust the table view.</p>"
            + "<ul><li>\"What is the total failed payment exposure by carrier?\"</li>"
            + "<li>\"Show monthly payment volume trends\"</li>"
            + "<li>\"Sort the table by amount, highest first\"</li></ul>"));
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

        // ── Clarification mode — ask questions before proceeding ──────────────
        List<String> clarificationQuestions = jsonList(decision, "clarificationQuestions");
        if (!clarificationQuestions.isEmpty()) {
            String intro = decision.has("directAnswer") && !decision.get("directAnswer").isJsonNull()
                ? decision.get("directAnswer").getAsString().trim() : "";
            StringBuilder html = new StringBuilder();
            if (!intro.isBlank()) html.append("<p>").append(esc(intro)).append("</p>");
            if (clarificationQuestions.size() == 1) {
                html.append("<p>").append(esc(clarificationQuestions.get(0))).append("</p>");
            } else {
                html.append("<ul>");
                clarificationQuestions.forEach(q -> html.append("<li>").append(esc(q)).append("</li>"));
                html.append("</ul>");
            }
            String raw = (intro.isBlank() ? "" : intro + " ") + String.join(" ", clarificationQuestions);
            messages.add(new ChatMessage("assistant", "Analyst", raw.trim(), html.toString()));
            history.add(Map.of("role", "assistant", "content", raw.trim()));
            statusMessage = "Done.";
            return;
        }

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
            String direct = decision.has("directAnswer") && !decision.get("directAnswer").isJsonNull()
                ? decision.get("directAnswer").getAsString() : "";
            if (direct.isBlank()) direct = gridApplied ? "Grid updated." : "Analysis complete.";
            messages.add(buildTextMessage(direct, gridApplied));
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
                String direct = decision.has("directAnswer") && !decision.get("directAnswer").isJsonNull()
                    ? decision.get("directAnswer").getAsString()
                    : "The query could not be constructed from the available data. Try rephrasing the request.";
                messages.add(buildTextMessage(direct, gridApplied));
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

            // Update DataTable with query results whenever SQL ran — not just in visual mode
            if (!finalRows.isEmpty()) {
                appBean.loadAnalysisResults(finalColumns, finalRows);
                // Store drilldown context so the detail dialog can show source records
                List<String> gbCols = detectGroupByColumns(steps);
                if (!gbCols.isEmpty()) {
                    appBean.setDrilldownContext(fetchPreAggRows(steps, ds), gbCols);
                } else {
                    appBean.clearDrilldownContext();
                }
            }

            // Build chart — honour explicit type the user requested
            String requestedChartType = decision.has("chartType") && !decision.get("chartType").isJsonNull()
                ? decision.get("chartType").getAsString() : null;
            ChartResult chart = (hasVisual || !finalRows.isEmpty())
                ? chartFactory.create(finalColumns, finalRows, requestedChartType) : null;

            // ── Stage 2: generate answer from SQL results ─────────────────────
            String answer;

            if (hasAnswer) {
                statusMessage = "Summarizing findings…";
                Map<String, Object> facts = analysisService.computeSummaryFacts(finalColumns, finalRows, steps);
                String answerPrompt = buildFinalAnswerPrompt(ds, prompt, finalColumns, finalRows, recent, scope, facts, steps);
                JsonObject answerJson = callModelJson(answerPrompt, null);
                answer = answerJson.has("answer") ? answerJson.get("answer").getAsString() : "Analysis complete.";
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

            ChatMessage msg = buildAnalysisMessage(answer,
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
            String msg = gridApplied ? "Grid updated." : "Could not apply the grid change.";
            messages.add(new ChatMessage("assistant", "Analyst", msg,
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
            Datasets available: payments, sepDemo, adjustments, exceptions, candy

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
        boolean isPayment = List.of("payments","sepDemo","adjustments","exceptions").contains(datasetId);
        boolean isCandy   = "candy".equals(datasetId);
        StringBuilder sb  = new StringBuilder("EXAMPLES:\n");

        if (isPayment) {
            sb.append("""
                Q: "Show me the payments data"
                A: {"modes":["answer"],"confidence":"low","clarificationQuestions":["What aspect would be most useful — totals by status, approval rates, or declined payment exposure?","Is there a particular time period you'd like to focus on?"],"needsQuery":false,"directAnswer":"A couple of things to confirm before I pull the data:","gridChange":null}

                Q: "What is performing well?"
                A: {"modes":["answer"],"confidence":"low","clarificationQuestions":["Which metric defines performance here — approval rate, total amount processed, or count of approved transactions?","Are you comparing across time periods or looking at the current snapshot?"],"needsQuery":false,"directAnswer":"One clarification before I proceed:","gridChange":null}

                Q: "Chart declined payments by status"
                A: {"modes":["visual","answer"],"confidence":"high","clarificationQuestions":[],"needsQuery":true,"chartType":null,"chartTitle":"Declined vs Approved Payment Exposure","scope":"base_dataset","steps":[{"label":"Counting by status","op":"groupBy","columns":["status"],"aggregations":[{"column":"amount","fn":"SUM","alias":"totalAmount"},{"column":"*","fn":"COUNT","alias":"count"}],"sort":{"column":"totalAmount","direction":"DESC"}}],"gridChange":null}

                Q: "How many payments are there by status?"
                A: {"modes":["visual","answer"],"confidence":"high","clarificationQuestions":[],"needsQuery":true,"chartType":null,"chartTitle":"Payment Count and Total Amount by Status","scope":"base_dataset","steps":[{"label":"Counting by status","op":"groupBy","columns":["status"],"aggregations":[{"column":"*","fn":"COUNT","alias":"count"},{"column":"amount","fn":"SUM","alias":"totalAmount"}],"sort":{"column":"count","direction":"DESC"}}],"gridChange":null}

                Q: "Give me a pie chart of payments by status"
                A: {"modes":["visual","answer"],"confidence":"high","clarificationQuestions":[],"needsQuery":true,"chartType":"pie","chartTitle":"Payment Distribution by Status","scope":"base_dataset","steps":[{"label":"Grouping by status","op":"groupBy","columns":["status"],"aggregations":[{"column":"*","fn":"COUNT","alias":"count"},{"column":"amount","fn":"SUM","alias":"totalAmount"}],"sort":{"column":"count","direction":"DESC"}}],"gridChange":null}

                Q: "What is the total approved amount?"
                A: {"modes":["answer"],"confidence":"high","clarificationQuestions":[],"needsQuery":true,"chartType":null,"chartTitle":null,"scope":"base_dataset","steps":[{"label":"Filtering to approved","op":"filter","conditions":[{"column":"status","op":"eq","value":"APPROVED"}]},{"label":"Summing approved amount","op":"groupBy","columns":["status"],"aggregations":[{"column":"amount","fn":"SUM","alias":"approvedTotal"},{"column":"*","fn":"COUNT","alias":"count"}]}],"gridChange":null}

                Q: "Show a line chart of payments over time"
                A: {"modes":["visual","answer"],"confidence":"high","clarificationQuestions":[],"needsQuery":true,"chartType":"line","chartTitle":"Total Payment Amount — Month over Month","scope":"base_dataset","steps":[{"label":"Payments over time","op":"timeSeries","dateColumn":"depositDate","granularity":"month","aggregations":[{"column":"amount","fn":"SUM","alias":"totalAmount"}]}],"gridChange":null}

                Q: "Compare approved vs declined amounts"
                A: {"modes":["visual","answer"],"confidence":"high","clarificationQuestions":[],"needsQuery":true,"chartType":"bar","chartTitle":"Approved vs Declined — Total Amount","scope":"base_dataset","steps":[{"label":"Comparing approved vs declined","op":"compare","segments":[{"label":"Approved","conditions":[{"column":"status","op":"eq","value":"APPROVED"}]},{"label":"Declined","conditions":[{"column":"status","op":"eq","value":"DECLINED"}]}],"metrics":[{"column":"amount","fn":"SUM","alias":"totalAmount"},{"column":"*","fn":"COUNT","alias":"count"}]}],"gridChange":null}

                Q: "Sort the grid by amount, highest first"
                A: {"modes":["grid"],"confidence":"high","clarificationQuestions":[],"needsQuery":false,"chartType":null,"chartTitle":null,"gridChange":{"sort":[{"field":"amount","direction":"desc"}]}}

                Q: "Sort the table by amount, highest first"
                A: {"modes":["grid"],"confidence":"high","clarificationQuestions":[],"needsQuery":false,"chartType":null,"chartTitle":null,"gridChange":{"sort":[{"field":"amount","direction":"desc"}]}}

                Q: "Sort by carrier then by amount descending"
                A: {"modes":["grid"],"confidence":"high","clarificationQuestions":[],"needsQuery":false,"chartType":null,"chartTitle":null,"gridChange":{"sort":[{"field":"carrier","direction":"asc"},{"field":"amount","direction":"desc"}]}}

                Q: "Order the data by status ascending"
                A: {"modes":["grid"],"confidence":"high","clarificationQuestions":[],"needsQuery":false,"chartType":null,"chartTitle":null,"gridChange":{"sort":[{"field":"status","direction":"asc"}]}}

                Q: "Clear all sorting"
                A: {"modes":["grid"],"confidence":"high","clarificationQuestions":[],"needsQuery":false,"chartType":null,"chartTitle":null,"gridChange":{"sort":[]}}
                """);
        }

        if (isCandy) {
            sb.append("""
                Q: "Give me a sales report"
                A: {"modes":["answer"],"confidence":"low","clarificationQuestions":["Which metric is most relevant — total revenue, units sold, or transaction count?","Should this cover all products and channels, or a specific segment or category?"],"needsQuery":false,"directAnswer":"A couple of things to confirm before I pull the data:","gridChange":null}

                Q: "How are sales looking?"
                A: {"modes":["answer"],"confidence":"low","clarificationQuestions":["Which metric would be most useful — revenue, units sold, or number of transactions?","Is there a particular time period, product category, or channel you'd like to focus on?"],"needsQuery":false,"directAnswer":"One clarification before I proceed:","gridChange":null}

                Q: "What's our best performing product?"
                A: {"modes":["answer"],"confidence":"low","clarificationQuestions":["How are you defining best performing — by total revenue, units sold, or customer satisfaction score?"],"needsQuery":false,"directAnswer":"One clarification before I proceed:","gridChange":null}

                Q: "Which customer segment is most valuable?"
                A: {"modes":["answer"],"confidence":"low","clarificationQuestions":["How are you defining value here — total revenue generated, average transaction size, or volume of transactions?"],"needsQuery":false,"directAnswer":"One clarification before I proceed:","gridChange":null}

                Q: "Is chocolate doing well?"
                A: {"modes":["answer"],"confidence":"low","clarificationQuestions":["What metric should I use to assess performance — total revenue, units sold, or margin?","Are you comparing chocolate against other categories, or against a prior period?"],"needsQuery":false,"directAnswer":"A couple of things to confirm:","gridChange":null}

                Q: "What should we focus on?"
                A: {"modes":["answer"],"confidence":"low","clarificationQuestions":["Are you looking to identify underperforming areas, growth opportunities, or something else?","Which dimension matters most — product category, store location, customer segment, or marketing channel?"],"needsQuery":false,"directAnswer":"Before I proceed, a couple of things to confirm:","gridChange":null}

                Q: "Chart revenue by marketing channel"
                A: {"modes":["visual","answer"],"confidence":"high","clarificationQuestions":[],"needsQuery":true,"chartType":null,"chartTitle":"Total Revenue by Marketing Channel","scope":"base_dataset","steps":[{"label":"Revenue by channel","op":"groupBy","columns":["marketingChannel"],"aggregations":[{"column":"total","fn":"SUM","alias":"totalRevenue"},{"column":"*","fn":"COUNT","alias":"transactions"}],"sort":{"column":"totalRevenue","direction":"DESC"}}],"gridChange":null}

                Q: "Sort the table by quantity, highest first"
                A: {"modes":["grid"],"confidence":"high","clarificationQuestions":[],"needsQuery":false,"chartType":null,"chartTitle":null,"gridChange":{"sort":[{"field":"quantity","direction":"desc"}]}}

                Q: "Sort the data by total revenue descending"
                A: {"modes":["grid"],"confidence":"high","clarificationQuestions":[],"needsQuery":false,"chartType":null,"chartTitle":null,"gridChange":{"sort":[{"field":"total","direction":"desc"}]}}

                Q: "Total revenue by product category"
                A: {"modes":["visual","answer"],"confidence":"high","clarificationQuestions":[],"needsQuery":true,"chartType":null,"chartTitle":"Total Revenue by Product Category","scope":"base_dataset","steps":[{"label":"Revenue by category","op":"groupBy","columns":["category"],"aggregations":[{"column":"total","fn":"SUM","alias":"totalRevenue"},{"column":"*","fn":"COUNT","alias":"transactions"}],"sort":{"column":"totalRevenue","direction":"DESC"}}],"gridChange":null}
                """);
        }

        return sb.toString();
    }

    private String buildFinalAnswerPrompt(DatasetInfo ds, String prompt,
                                           List<String> columns, List<Map<String, Object>> rows,
                                           List<Map<String, String>> chatHistory, String scope,
                                           Map<String, Object> facts, List<JsonObject> steps) {
        String histBlock = chatHistory.isEmpty() ? "" :
            "Prior conversation:\n" + chatHistory.stream()
                .map(m -> ("user".equals(m.get("role")) ? "User" : "Analyst") + ": " + m.get("content"))
                .collect(Collectors.joining("\n")) + "\n\n";
        String scopeLabel = switch (scope) {
            case "current_view" -> "the current visible grid view";
            default             -> "the full base dataset";
        };

        return """
            You are an experienced business analyst writing a briefing for an internal stakeholder.

            %sUser question: %s
            Dataset: %s, scope: %s

            Query executed:
            %s

            Verified facts:
            %s

            Result columns: %s
            Result rows (up to 50):
            %s

            WRITING REQUIREMENTS:
            - Write naturally, as a human analyst would. Do NOT use template section headers.
            - Do NOT include 'Key Insights', 'Recommended Actions', or 'Summary' sections.
            - Weave findings directly into the narrative. Lead with what is most significant.
            - Focus on operational and financial relevance: trends, anomalies, comparisons, risk.
            - Ground every figure in the result rows. Do not invent or estimate numbers.
            - Be concise. 2-5 sentences is usually sufficient; longer only if the data warrants it.
            - Professional tone only. No enthusiasm, no AI-assistant phrasing.
            - Only include a recommendation if the data directly supports it and it is proportionate
              to the finding. Connect it explicitly to what the data shows.

            Return JSON only: {"answer":"..."}
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

    // Returns the groupBy column(s) from the last aggregation step, or empty list if none.
    private List<String> detectGroupByColumns(List<JsonObject> steps) {
        for (int i = steps.size() - 1; i >= 0; i--) {
            String op = steps.get(i).has("op") ? steps.get(i).get("op").getAsString() : "";
            if ("groupBy".equals(op)) {
                List<String> cols = new ArrayList<>();
                if (steps.get(i).has("columns"))
                    steps.get(i).getAsJsonArray("columns").forEach(c -> cols.add(c.getAsString()));
                return cols;
            }
            if ("timeSeries".equals(op)) return List.of("period");
            if ("compare".equals(op))    return List.of("segment");
        }
        return List.of();
    }

    // Returns the rows that fed the final aggregation step — the raw source records for drilldown.
    private List<Map<String, Object>> fetchPreAggRows(List<JsonObject> steps, DatasetInfo ds) {
        try {
            if (steps.size() <= 1) {
                // Single-step aggregation: source is the full base dataset
                return new ArrayList<>(ds.getRows());
            }
            // Multi-step: query the intermediate table stored just before the last step
            String tableId = "__step_" + (steps.size() - 2);
            return analysisService.executeQuery("SELECT * FROM \"" + tableId + "\"");
        } catch (SQLException e) {
            System.err.println("[AiBean] fetchPreAggRows failed: " + e.getMessage());
            return new ArrayList<>(ds.getRows());
        }
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

    private ChatMessage buildAnalysisMessage(String answer,
                                              Map<String, Object> queryMeta, List<String> queryColumns,
                                              boolean gridApplied) {
        StringBuilder html = new StringBuilder("<p class=\"analysis-answer\">").append(esc(answer)).append("</p>");
        if (queryMeta != null) {
            html.append("<div class=\"answerMeta\">");
            if (queryMeta.containsKey("resultRowCount"))
                html.append("<span class=\"answerMetaChip\">").append(queryMeta.get("resultRowCount")).append(" result rows</span>");
            String scope = String.valueOf(queryMeta.getOrDefault("scope", ""));
            if ("current_view".equals(scope)) html.append("<span class=\"answerMetaChip\">Current view</span>");
            html.append("</div>");
        }
        if (queryColumns != null && !queryColumns.isEmpty())
            html.append("<p class=\"config-applied\">&#9998; Grid shows query results — click Restore View to go back.</p>");
        if (gridApplied)
            html.append("<p class=\"config-applied\">&#10003; Grid configuration also updated.</p>");
        return new ChatMessage("assistant", "Analyst", answer, html.toString());
    }

    private ChatMessage buildTextMessage(String answer, boolean gridApplied) {
        StringBuilder html = new StringBuilder("<p>").append(esc(answer)).append("</p>");
        if (gridApplied) html.append("<p class=\"config-applied\">&#10003; Grid also updated.</p>");
        return new ChatMessage("assistant", "Analyst", answer, html.toString());
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
        catch (JsonSyntaxException e) { return new JsonObject(); }
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
