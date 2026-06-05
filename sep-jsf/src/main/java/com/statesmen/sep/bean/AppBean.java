package com.statesmen.sep.bean;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.primefaces.model.SortMeta;
import org.primefaces.model.SortOrder;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;
import com.statesmen.sep.data.DatasetService;
import com.statesmen.sep.model.ColumnDef;
import com.statesmen.sep.model.DatasetInfo;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.SessionScoped;
import jakarta.faces.model.SelectItem;
import jakarta.inject.Inject;
import jakarta.inject.Named;

@Named
@SessionScoped
public class AppBean implements Serializable {

    @Inject
    private DatasetService datasetService;

    private String selectedDataset = "payments";
    private List<ColumnDef> allColumns = new ArrayList<>();
    private List<Map<String, Object>> currentRows = new ArrayList<>();
    private List<Map<String, Object>> filteredRows;
    private List<SortMeta> sortMeta = new ArrayList<>();
    private boolean analysisViewActive = false;
    private final Map<String, QuerySnapshot> querySnapshots = new LinkedHashMap<>();

    private Map<String, Object> selectedRow = null;

    private String currentChartJson  = null;
    private String currentChartTitle = "";

    // Drilldown context — the pre-aggregation rows and groupBy columns for the current analysis view
    private List<Map<String, Object>> preAggRows    = new ArrayList<>();
    private List<String>              groupByFields = new ArrayList<>();

    public static class QuerySnapshot implements java.io.Serializable {
        private final List<String> columns;
        private final List<Map<String, Object>> rows;
        public QuerySnapshot(List<String> c, List<Map<String, Object>> r) { columns = c; rows = r; }
        public List<String> getColumns() { return columns; }
        public List<Map<String, Object>> getRows() { return rows; }
    }

    private String configJson = "";
    private String statusMessage = "Ready. Multi-sort: Shift+click column headers to add secondary sorting.";
    private String statusTone = "info";

    @PostConstruct
    public void init() {
        loadDataset("payments");
        exportConfig();
    }

    // ── Dataset switching ────────────────────────────────────────────────────

    private void loadDataset(String datasetId) {
        DatasetInfo info = datasetService.getDataset(datasetId);
        this.allColumns = info.getColumns().stream()
            .map(c -> new ColumnDef(c.getField(), c.getHeaderText(), c.isNumeric(), c.isCurrency()))
            .collect(Collectors.toList());
        this.currentRows = new ArrayList<>(info.getRows());
        this.filteredRows = null;
        this.sortMeta = new ArrayList<>();
        clearDrilldownContext();
    }

    public void setDrilldownContext(List<Map<String, Object>> rows, List<String> fields) {
        this.preAggRows    = rows   != null ? rows   : new ArrayList<>();
        this.groupByFields = fields != null ? fields : new ArrayList<>();
    }

    public void clearDrilldownContext() {
        this.preAggRows    = new ArrayList<>();
        this.groupByFields = new ArrayList<>();
    }

    public String getPreAggRowsJson() {
        if (preAggRows.isEmpty()) return "[]";
        return new Gson().toJson(preAggRows);
    }

    public String getGroupByFieldsJson() {
        if (groupByFields.isEmpty()) return "[]";
        return new Gson().toJson(groupByFields);
    }

    public void onDatasetChange() {
        loadDataset(selectedDataset);
        exportConfig();
        setStatus("Switched to \"" + datasetService.getDataset(selectedDataset).getLabel() + "\".", "info");
    }

    public void resetView() {
        loadDataset(selectedDataset);
        analysisViewActive = false;
        exportConfig();
        setStatus("Reset to default view.", "info");
    }

    // ── Analysis result loading (called by AiBean after SQL query) ────────────

    public void loadAnalysisResults(List<String> columns, List<Map<String, Object>> rows) {
        this.allColumns = columns.stream().map(col -> {
            // Detect numeric columns by checking the first non-null value
            boolean numeric = rows.stream()
                .map(r -> r.get(col))
                .filter(Objects::nonNull)
                .findFirst()
                .map(v -> v instanceof Number)
                .orElse(false);
            return new ColumnDef(col, formatHeader(col), numeric, false);
        }).collect(Collectors.toList());
        this.currentRows  = new ArrayList<>(rows);
        this.filteredRows = null;
        this.sortMeta     = new ArrayList<>();
        this.analysisViewActive = true;
        exportConfig(); // keep configJson in sync so follow-up sort/column patches use the right schema
    }

    /**
     * Called by PrimeFaces colReorder AJAX event when the user drags a column to a new position.
     * Reads fromIndex / toIndex from the request parameters and reorders allColumns to match.
     */
    public void onSort() {
        exportConfig();
    }

    public void onColumnReorder() {
        Map<String, String> params = jakarta.faces.context.FacesContext.getCurrentInstance()
            .getExternalContext().getRequestParameterMap();

        // PrimeFaces sends 0-based DOM indices across ALL columns; subtract 1 for the fixed action column at slot 0
        int from = parseIntOrDefault(params.get("fromIndex"), -1) - 1;
        int to   = parseIntOrDefault(params.get("toIndex"),   -1) - 1;

        if (from < 0 || to < 0 || from == to) return;

        List<ColumnDef> visible = allColumns.stream()
            .filter(ColumnDef::isVisible).collect(Collectors.toList());

        if (from >= visible.size() || to >= visible.size()) return;

        // Reorder the visible-column list
        ColumnDef moved = visible.remove(from);
        visible.add(to, moved);

        // Rebuild allColumns: visible slots take the new order; hidden slots stay in place
        int vi = 0;
        List<ColumnDef> result = new ArrayList<>();
        for (ColumnDef col : allColumns) {
            result.add(col.isVisible() ? visible.get(vi++) : col);
        }
        allColumns = result;
        exportConfig();
    }

    private int parseIntOrDefault(String s, int def) {
        try { return s != null ? Integer.parseInt(s) : def; }
        catch (NumberFormatException e) { return def; }
    }

    public void storeChartJson(String json, String title) {
        this.currentChartJson  = json;
        this.currentChartTitle = title != null ? title : "Analysis Results";
    }

    public void clearChart() {
        currentChartJson  = null;
        currentChartTitle = "";
    }

    public String  getCurrentChartJson()  { return currentChartJson; }
    public void    setCurrentChartJson(String v) { this.currentChartJson = v; }
    public String  getCurrentChartTitle()          { return currentChartTitle; }
    public void    setCurrentChartTitle(String v)  { this.currentChartTitle = v != null ? v.trim() : ""; }

    /** Empty Chart.js config — returned so a hidden <p:chart> can force PrimeFaces to include chart.min.js */
    public String getMinimalChartJson() {
        return "{\"type\":\"bar\",\"data\":{\"labels\":[],\"datasets\":[]}}";
    }

    // ── Row detail view ───────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public void setSelectedRow(Object row) {
        if (row instanceof Map) this.selectedRow = new LinkedHashMap<>((Map<String, Object>) row);
    }
    public Map<String, Object> getSelectedRow() { return selectedRow; }

    public List<Map.Entry<String, Object>> getSelectedRowEntries() {
        if (selectedRow == null) return Collections.emptyList();
        return new ArrayList<>(selectedRow.entrySet());
    }

    public String rowToJson(Map<String, Object> row) {
        if (row == null) return "{}";
        return new Gson().toJson(row);
    }

    public String formatFieldName(String field) {
        if (field == null) return "";
        String spaced = field.replaceAll("([A-Z])", " $1").replace("_", " ").trim();
        if (spaced.isEmpty()) return field;
        return Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }

    public boolean isSelectedRowCurrency(String field) {
        return allColumns.stream()
            .filter(c -> c.getField().equals(field))
            .findFirst()
            .map(ColumnDef::isCurrency)
            .orElse(false);
    }

    public void storeQuerySnapshot(String id, List<String> columns, List<Map<String, Object>> rows) {
        querySnapshots.put(id, new QuerySnapshot(new ArrayList<>(columns), new ArrayList<>(rows)));
    }

    public void restoreSnapshot(String snapshotId) {
        QuerySnapshot snap = querySnapshots.get(snapshotId);
        if (snap == null) return;
        loadAnalysisResults(snap.getColumns(), snap.getRows());
        setStatus("View restored from conversation.", "success");
    }

    public void restoreDatasetView() {
        loadDataset(selectedDataset);
        analysisViewActive = false;
        exportConfig();
        setStatus("Restored dataset view.", "info");
    }

    private String formatHeader(String field) {
        // "totalFailedAmount" → "Total Failed Amount"
        return field.replaceAll("([A-Z])", " $1").trim()
                    .replace("_", " ")
                    .replaceAll("\\s+", " ");
    }

    // ── Column visibility ─────────────────────────────────────────────────────

    public List<ColumnDef> getVisibleColumns() {
        return allColumns.stream().filter(ColumnDef::isVisible).collect(Collectors.toList());
    }

    public void applyColumnVisibility() {
        exportConfig();
    }

    // ── JSON config ───────────────────────────────────────────────────────────

    public void applyConfig() {
        try {
            JsonObject parsed = JsonParser.parseString(configJson).getAsJsonObject();

            // Unwrap AI-generated configs that carry a type envelope
            if (parsed.has("type")) {
                String type = parsed.get("type").getAsString();
                if ("table_config".equals(type) && parsed.has("config")) {
                    parsed = parsed.getAsJsonObject("config");
                } else if ("table_config_patch".equals(type) && parsed.has("patch")) {
                    applyPatch(parsed.getAsJsonObject("patch"));
                    exportConfig();
                    setStatus("Config patch applied.", "success");
                    return;
                }
            }

            applyTableConfig(parsed);
            exportConfig();
            setStatus("JSON config applied.", "success");
        } catch (JsonSyntaxException e) {
            setStatus("Invalid JSON: " + e.getMessage(), "error");
        }
    }

    private void applyTableConfig(JsonObject config) {
        // Dataset switch — support both "dataset" (new) and "datasetId" (legacy)
        String newDs = config.has("dataset")   ? config.get("dataset").getAsString()
                     : config.has("datasetId") ? config.get("datasetId").getAsString() : null;
        if (newDs != null && !newDs.equals(selectedDataset)) {
            selectedDataset = newDs;
            loadDataset(newDs);
        }

        // Columns — new format: ["field1","field2",...] where position = display order, absence = hidden
        //         — legacy format: {"order":[...],"hidden":[...]} object
        if (config.has("columns")) {
            JsonElement colEl = config.get("columns");
            if (colEl.isJsonArray()) {
                applyColumnOrder(colEl.getAsJsonArray());
            } else if (colEl.isJsonObject()) {
                applyColumnOrderLegacy(colEl.getAsJsonObject());
            }
        }

        // Sort — array in priority order; first entry = primary sort
        if (config.has("sort") && config.get("sort").isJsonArray()) {
            sortMeta = new ArrayList<>();
            int priority = 0;
            for (JsonElement el : config.getAsJsonArray("sort")) {
                if (!el.isJsonObject()) continue;
                JsonObject s = el.getAsJsonObject();
                if (!s.has("field")) continue;
                String field = s.get("field").getAsString();
                String dir = s.has("direction") ? s.get("direction").getAsString()
                           : s.has("sort")      ? s.get("sort").getAsString() : "asc";
                sortMeta.add(SortMeta.builder()
                    .field(field)
                    .order("desc".equalsIgnoreCase(dir) ? SortOrder.DESCENDING : SortOrder.ASCENDING)
                    .priority(priority++)
                    .build());
            }
            // Immediately sort the in-memory rows so the grid reflects the new order.
            // PrimeFaces DataTable only auto-sorts on user header-clicks; programmatic
            // sortMeta changes require us to sort the underlying list ourselves.
            sortRows();
        }
    }

    // Sort currentRows (and filteredRows if active) according to the current sortMeta.
    private void sortRows() {
        if (sortMeta.isEmpty() || currentRows.isEmpty()) return;

        // Build a field-name resolver: exact match first, then case-insensitive contains-match.
        // This handles the common case where the user says "sort by amount" but the aggregated
        // column is named "totalAmount" or "SUM_amount" from the query alias.
        Set<String> availableFields = currentRows.get(0).keySet();
        java.util.function.Function<String, String> resolve = requested -> {
            if (availableFields.contains(requested)) return requested;
            String lower = requested.toLowerCase();
            return availableFields.stream()
                .filter(f -> f.toLowerCase().contains(lower) || lower.contains(f.toLowerCase()))
                .findFirst().orElse(requested);
        };

        List<SortMeta> ordered = sortMeta.stream()
            .sorted(java.util.Comparator.comparingInt(SortMeta::getPriority))
            .collect(Collectors.toList());
        java.util.Comparator<Map<String, Object>> cmp = (a, b) -> {
            for (SortMeta sm : ordered) {
                String field = resolve.apply(sm.getField());
                int c = compareValues(a.get(field), b.get(field));
                if (c != 0) return sm.getOrder() == SortOrder.DESCENDING ? -c : c;
            }
            return 0;
        };
        currentRows.sort(cmp);
        if (filteredRows != null && !filteredRows.isEmpty()) filteredRows.sort(cmp);
    }

    private int compareValues(Object a, Object b) {
        if (a == null && b == null) return 0;
        if (a == null) return -1;
        if (b == null) return 1;
        if (a instanceof Number && b instanceof Number)
            return Double.compare(((Number) a).doubleValue(), ((Number) b).doubleValue());
        return a.toString().compareToIgnoreCase(b.toString());
    }

    // New column format: ["field1","field2",...] — visible fields in display order, absent = hidden
    private void applyColumnOrder(JsonArray orderedFields) {
        List<String> visibleOrder = new ArrayList<>();
        orderedFields.forEach(e -> { if (e.isJsonPrimitive()) visibleOrder.add(e.getAsString()); });
        if (visibleOrder.isEmpty()) return;

        Set<String> visibleSet = new HashSet<>(visibleOrder);
        List<ColumnDef> reordered = new ArrayList<>();

        for (String field : visibleOrder) {
            allColumns.stream().filter(c -> c.getField().equals(field)).findFirst()
                .ifPresent(col -> { col.setVisible(true); reordered.add(col); });
        }
        // Preserve hidden columns at the end so they can be re-shown later
        allColumns.stream().filter(c -> !visibleSet.contains(c.getField()))
            .forEach(col -> { col.setVisible(false); reordered.add(col); });

        if (!reordered.isEmpty()) allColumns = reordered;
    }

    // Legacy column format: {"order":[...],"hidden":[...]}
    private void applyColumnOrderLegacy(JsonObject cols) {
        Set<String> hidden = new HashSet<>();
        if (cols.has("hidden")) cols.getAsJsonArray("hidden").forEach(e -> hidden.add(e.getAsString()));

        if (cols.has("order")) {
            List<String> order = new ArrayList<>();
            cols.getAsJsonArray("order").forEach(e -> order.add(e.getAsString()));
            List<ColumnDef> reordered = new ArrayList<>();
            for (String f : order) {
                allColumns.stream().filter(c -> c.getField().equals(f)).findFirst().ifPresent(reordered::add);
            }
            allColumns.stream().filter(c -> !order.contains(c.getField())).forEach(reordered::add);
            allColumns = reordered;
        }
        allColumns.forEach(c -> c.setVisible(!hidden.contains(c.getField())));
    }

    public void applyGridPatch(JsonObject patch) {
        if (analysisViewActive && patch.has("columns")) {
            // In analysis view the visible columns are owned by the query result, not the grid config.
            // Strip any "columns" key from the patch so the AI cannot accidentally hide them.
            JsonObject sortOnly = new JsonObject();
            patch.entrySet().forEach(e -> { if (!"columns".equals(e.getKey())) sortOnly.add(e.getKey(), e.getValue()); });
            applyPatch(sortOnly);
        } else {
            applyPatch(patch);
        }
        exportConfig();
    }

    private void applyPatch(JsonObject patch) {
        // Apply each key independently — a sort-only patch NEVER touches columns, and vice versa.
        // The old approach merged the patch into the full configJson and re-applied everything,
        // which caused a sort patch to accidentally re-process stale columns from the previous config.
        try {
            if (patch.has("dataset") || patch.has("datasetId")) {
                String newDs = patch.has("dataset") ? patch.get("dataset").getAsString()
                             : patch.get("datasetId").getAsString();
                if (!newDs.equals(selectedDataset)) { selectedDataset = newDs; loadDataset(newDs); }
            }
            if (patch.has("columns")) {
                JsonElement colEl = patch.get("columns");
                if (colEl.isJsonArray()) applyColumnOrder(colEl.getAsJsonArray());
                else if (colEl.isJsonObject()) applyColumnOrderLegacy(colEl.getAsJsonObject());
            }
            if (patch.has("sort") && patch.get("sort").isJsonArray()) {
                sortMeta = new ArrayList<>();
                int priority = 0;
                for (JsonElement el : patch.getAsJsonArray("sort")) {
                    if (!el.isJsonObject()) continue;
                    JsonObject s = el.getAsJsonObject();
                    if (!s.has("field")) continue;
                    String field = s.get("field").getAsString();
                    String dir = s.has("direction") ? s.get("direction").getAsString() : "asc";
                    sortMeta.add(SortMeta.builder()
                        .field(field)
                        .order("desc".equalsIgnoreCase(dir) ? SortOrder.DESCENDING : SortOrder.ASCENDING)
                        .priority(priority++)
                        .build());
                }
                sortRows();
            }
        } catch (Exception ignored) {}
    }

    // ── Export config ─────────────────────────────────────────────────────────

    public void exportConfig() {
        Gson gson = new GsonBuilder().setPrettyPrinting().create();
        JsonObject config = new JsonObject();
        config.addProperty("dataset", selectedDataset);

        // columns: visible field names in display order — position = order, absence = hidden
        JsonArray columns = new JsonArray();
        allColumns.stream().filter(ColumnDef::isVisible).forEach(c -> columns.add(c.getField()));
        config.add("columns", columns);

        // sort: priority order — first entry is primary sort
        JsonArray sort = new JsonArray();
        sortMeta.forEach(sm -> {
            JsonObject s = new JsonObject();
            s.addProperty("field",     sm.getField());
            s.addProperty("direction", sm.getOrder() == SortOrder.DESCENDING ? "desc" : "asc");
            sort.add(s);
        });
        config.add("sort", sort);

        configJson = gson.toJson(config);
    }

    public void resetConfig() {
        allColumns.forEach(c -> c.setVisible(true));
        sortMeta     = new ArrayList<>();
        filteredRows = null;
        exportConfig();
        setStatus("Reset to default configuration.", "success");
    }

    // ── Column footer totals ──────────────────────────────────────────────────

    public String getColumnFooter(ColumnDef col) {
        if (!col.isNumeric()) return null;
        List<Map<String, Object>> rows = filteredRows != null ? filteredRows : currentRows;
        double total = rows.stream()
            .mapToDouble(row -> {
                Object v = row.get(col.getField());
                return v instanceof Number ? ((Number) v).doubleValue() : 0;
            })
            .sum();
        return col.isCurrency() ? String.format("$%,.2f", total) : String.format("%,.2f", total);
    }

    // ── Dataset select options ────────────────────────────────────────────────

    public List<SelectItem> getDatasetOptions() {
        return datasetService.getAllDatasets().stream()
            .map(d -> new SelectItem(d.getId(), d.getLabel()))
            .collect(Collectors.toList());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void setStatus(String message, String tone) {
        this.statusMessage = message;
        this.statusTone    = tone;
    }

    // Expose allColumns for the column toggle overlay
    public List<ColumnDef> getAllColumns() { return allColumns; }

    // ── Getters / setters ─────────────────────────────────────────────────────

    public String getSelectedDataset()                              { return selectedDataset; }
    public void   setSelectedDataset(String selectedDataset)        { this.selectedDataset = selectedDataset; }

    public List<Map<String, Object>> getCurrentRows()               { return currentRows; }

    public List<Map<String, Object>> getFilteredRows()              { return filteredRows; }
    public void   setFilteredRows(List<Map<String, Object>> v)      { this.filteredRows = v; }

    public List<SortMeta> getSortMeta()                             { return sortMeta; }
    public void           setSortMeta(List<SortMeta> sortMeta)      { this.sortMeta = sortMeta; }

    public String getConfigJson()                                   { return configJson; }
    public void   setConfigJson(String configJson)                  { this.configJson = configJson; }

    public String getStatusMessage()                                { return statusMessage; }
    public String  getStatusTone()                                  { return statusTone; }
    public boolean isAnalysisViewActive()                          { return analysisViewActive; }
}
