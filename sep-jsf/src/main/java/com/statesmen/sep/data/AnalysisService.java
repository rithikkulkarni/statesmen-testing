package com.statesmen.sep.data;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.statesmen.sep.model.ColumnDef;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import java.sql.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * H2 in-memory SQL engine — Java equivalent of the DuckDB + structured query builder
 * in vite.config.js. Accepts the same step JSON the AI produces, builds SQL, and
 * executes it against a per-dataset H2 table.
 */
@Named
@ApplicationScoped
public class AnalysisService {

    private Connection conn;

    @PostConstruct
    public void init() {
        try {
            Class.forName("org.h2.Driver");
            // DATABASE_TO_UPPER=FALSE keeps column names case-as-stored
            conn = DriverManager.getConnection(
                "jdbc:h2:mem:sepdb;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=FALSE", "sa", "");
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize H2", e);
        }
    }

    // ── Table management ──────────────────────────────────────────────────────

    public synchronized void ensureTable(String tableId, List<Map<String, Object>> rows) throws SQLException {
        if (rows == null || rows.isEmpty()) return;
        Map<String, Object> sample = rows.get(0);
        List<String> cols = new ArrayList<>(sample.keySet());

        try (Statement s = conn.createStatement()) {
            s.execute("DROP TABLE IF EXISTS \"" + tableId + "\"");
        }

        StringBuilder create = new StringBuilder("CREATE TABLE \"").append(tableId).append("\" (");
        List<String> defs = new ArrayList<>();
        for (String col : cols) {
            Object v = sample.get(col);
            String type = (v instanceof Number) ? "DOUBLE" : "VARCHAR(32767)";
            defs.add("\"" + col + "\" " + type);
        }
        create.append(String.join(", ", defs)).append(")");

        try (Statement s = conn.createStatement()) {
            s.execute(create.toString());
        }

        String placeholders = String.join(", ", Collections.nCopies(cols.size(), "?"));
        String insert = "INSERT INTO \"" + tableId + "\" VALUES (" + placeholders + ")";
        try (PreparedStatement ps = conn.prepareStatement(insert)) {
            for (Map<String, Object> row : rows) {
                for (int i = 0; i < cols.size(); i++) {
                    Object val = row.get(cols.get(i));
                    if (val == null)            ps.setNull(i + 1, Types.VARCHAR);
                    else if (val instanceof Number) ps.setDouble(i + 1, ((Number) val).doubleValue());
                    else                         ps.setString(i + 1, val.toString());
                }
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    public synchronized List<Map<String, Object>> executeQuery(String sql) throws SQLException {
        try (Statement s = conn.createStatement(); ResultSet rs = s.executeQuery(sql)) {
            return toList(rs);
        }
    }

    private List<Map<String, Object>> toList(ResultSet rs) throws SQLException {
        ResultSetMetaData meta = rs.getMetaData();
        int cols = meta.getColumnCount();
        List<Map<String, Object>> out = new ArrayList<>();
        while (rs.next()) {
            Map<String, Object> row = new LinkedHashMap<>();
            for (int i = 1; i <= cols; i++) {
                String name = meta.getColumnLabel(i);
                Object val = rs.getObject(i);
                if (val instanceof java.math.BigDecimal) val = ((java.math.BigDecimal) val).doubleValue();
                row.put(name, val);
            }
            out.add(row);
        }
        return out;
    }

    // ── SQL builder — faithful port of buildStepSql() in vite.config.js ──────

    public String buildStepSql(JsonObject step, String source) {
        String op = step.get("op").getAsString();
        return switch (op) {
            case "filter"     -> buildFilterSql(step, source);
            case "groupBy"    -> buildGroupBySql(step, source);
            case "sort"       -> buildSortSql(step, source);
            case "select"     -> buildSelectSql(step, source);
            case "topN"       -> buildTopNSql(step, source);
            case "distinct"   -> buildDistinctSql(step, source);
            case "timeSeries" -> buildTimeSeriesSql(step, source);
            case "compare"    -> buildCompareSql(step, source);
            case "pivot"      -> buildPivotFallbackSql(step, source);
            default           -> throw new IllegalArgumentException("Unknown op: " + op);
        };
    }

    private String buildFilterSql(JsonObject step, String source) {
        JsonArray conditions = step.has("conditions") ? step.getAsJsonArray("conditions") : new JsonArray();
        String logic = step.has("logic") ? step.get("logic").getAsString() : "AND";
        List<String> conds = new ArrayList<>();
        conditions.forEach(c -> conds.add(buildConditionSql(c.getAsJsonObject())));
        String where = conds.isEmpty() ? "" : " WHERE " + String.join(" " + logic + " ", conds);
        return "SELECT * FROM " + source + where;
    }

    private String buildGroupBySql(JsonObject step, String source) {
        JsonArray groupCols = step.has("columns") ? step.getAsJsonArray("columns") : new JsonArray();
        JsonArray aggs      = step.has("aggregations") ? step.getAsJsonArray("aggregations") : new JsonArray();

        List<String> selects = new ArrayList<>();
        groupCols.forEach(c -> selects.add(quoteName(c.getAsString())));
        aggs.forEach(a -> selects.add(buildAggSql(a.getAsJsonObject())));

        StringBuilder sql = new StringBuilder("SELECT ")
            .append(selects.isEmpty() ? "*" : String.join(", ", selects))
            .append(" FROM ").append(source);

        if (groupCols.size() > 0) {
            List<String> gc = new ArrayList<>();
            groupCols.forEach(c -> gc.add(quoteName(c.getAsString())));
            sql.append(" GROUP BY ").append(String.join(", ", gc));
        }

        if (step.has("sort")) {
            JsonObject sort = step.getAsJsonObject("sort");
            String dir = sort.has("direction") ? sort.get("direction").getAsString().toUpperCase() : "DESC";
            if (!"ASC".equals(dir)) dir = "DESC";
            sql.append(" ORDER BY ").append(quoteName(sort.get("column").getAsString())).append(" ").append(dir);
        }

        if (step.has("limit")) {
            sql.append(" LIMIT ").append(Math.max(1, step.get("limit").getAsInt()));
        }

        return sql.toString();
    }

    private String buildSortSql(JsonObject step, String source) {
        JsonArray by = step.has("by") ? step.getAsJsonArray("by") : new JsonArray();
        List<String> parts = new ArrayList<>();
        by.forEach(b -> {
            JsonObject bo = b.getAsJsonObject();
            String dir = bo.has("direction") ? bo.get("direction").getAsString().toUpperCase() : "ASC";
            if (!"DESC".equals(dir)) dir = "ASC";
            parts.add(quoteName(bo.get("column").getAsString()) + " " + dir);
        });
        StringBuilder sql = new StringBuilder("SELECT * FROM ").append(source);
        if (!parts.isEmpty()) sql.append(" ORDER BY ").append(String.join(", ", parts));
        if (step.has("limit")) sql.append(" LIMIT ").append(Math.max(1, step.get("limit").getAsInt()));
        return sql.toString();
    }

    private String buildSelectSql(JsonObject step, String source) {
        JsonArray cols = step.has("columns") ? step.getAsJsonArray("columns") : new JsonArray();
        List<String> cs = new ArrayList<>();
        cols.forEach(c -> cs.add(quoteName(c.getAsString())));
        return "SELECT " + (cs.isEmpty() ? "*" : String.join(", ", cs)) + " FROM " + source;
    }

    private String buildTopNSql(JsonObject step, String source) {
        String dir = step.has("direction") ? step.get("direction").getAsString().toUpperCase() : "DESC";
        if (!"ASC".equals(dir)) dir = "DESC";
        int n = step.has("n") ? Math.max(1, step.get("n").getAsInt()) : 10;
        return "SELECT * FROM " + source
             + " ORDER BY " + quoteName(step.get("column").getAsString()) + " " + dir
             + " LIMIT " + n;
    }

    private String buildDistinctSql(JsonObject step, String source) {
        JsonArray cols = step.has("columns") ? step.getAsJsonArray("columns") : new JsonArray();
        List<String> cs = new ArrayList<>();
        cols.forEach(c -> cs.add(quoteName(c.getAsString())));
        String colSql = cs.isEmpty() ? "*" : String.join(", ", cs);
        return "SELECT DISTINCT " + colSql + " FROM " + source + " ORDER BY " + colSql;
    }

    private String buildTimeSeriesSql(JsonObject step, String source) {
        String[] validGran = {"day","week","month","quarter","year"};
        String gran = "month";
        if (step.has("granularity")) {
            String g = step.get("granularity").getAsString().toLowerCase();
            for (String vg : validGran) { if (vg.equals(g)) { gran = g; break; } }
        }
        JsonArray aggs = step.has("aggregations") ? step.getAsJsonArray("aggregations") : new JsonArray();
        List<String> aggSqls = new ArrayList<>();
        aggs.forEach(a -> aggSqls.add(buildAggSql(a.getAsJsonObject())));
        String dateCol = quoteName(step.get("dateColumn").getAsString());
        return "SELECT DATE_TRUNC('" + gran + "', CAST(" + dateCol + " AS DATE)) AS \"period\""
             + (aggSqls.isEmpty() ? "" : ", " + String.join(", ", aggSqls))
             + " FROM " + source
             + " GROUP BY \"period\" ORDER BY \"period\" ASC";
    }

    private String buildCompareSql(JsonObject step, String source) {
        JsonArray segs    = step.has("segments") ? step.getAsJsonArray("segments") : new JsonArray();
        JsonArray metrics = step.has("metrics")  ? step.getAsJsonArray("metrics")  : new JsonArray();
        List<String> metricSqls = new ArrayList<>();
        metrics.forEach(m -> metricSqls.add(buildAggSql(m.getAsJsonObject())));
        String metricStr = metricSqls.isEmpty() ? "COUNT(*) AS \"count\"" : String.join(", ", metricSqls);

        List<String> parts = new ArrayList<>();
        segs.forEach(s -> {
            JsonObject seg = s.getAsJsonObject();
            JsonArray conds = seg.has("conditions") ? seg.getAsJsonArray("conditions") : new JsonArray();
            String logic = seg.has("logic") ? seg.get("logic").getAsString() : "AND";
            List<String> cs = new ArrayList<>();
            conds.forEach(c -> cs.add(buildConditionSql(c.getAsJsonObject())));
            String where = cs.isEmpty() ? "" : " WHERE " + String.join(" " + logic + " ", cs);
            String label = seg.has("label") ? seg.get("label").getAsString() : "Segment";
            parts.add("SELECT " + quoteLiteral(label) + " AS \"segment\", " + metricStr
                    + " FROM " + source + where);
        });

        return String.join("\nUNION ALL\n", parts);
    }

    private String buildPivotFallbackSql(JsonObject step, String source) {
        // H2 doesn't support DuckDB-style PIVOT. Fall back to a groupBy on the row/col columns.
        String rowCol = step.has("rowColumn") ? quoteName(step.get("rowColumn").getAsString()) : "*";
        String colCol = step.has("colColumn") ? quoteName(step.get("colColumn").getAsString()) : "*";
        String fn     = step.has("fn") ? step.get("fn").getAsString().toUpperCase() : "COUNT";
        String valCol = step.has("valueColumn") ? step.get("valueColumn").getAsString() : null;
        String agg = (valCol != null && !"COUNT".equals(fn))
            ? fn + "(" + quoteName(valCol) + ") AS \"value\""
            : "COUNT(*) AS \"count\"";
        return "SELECT " + rowCol + ", " + colCol + ", " + agg
             + " FROM " + source + " GROUP BY " + rowCol + ", " + colCol
             + " ORDER BY " + rowCol + ", " + colCol;
    }

    // ── Condition SQL ─────────────────────────────────────────────────────────

    /**
     * Normalise a condition operator from whatever the model returned to a canonical
     * internal name.  Handles camelCase, snake_case, verbose English names, and common
     * synonyms so that novel model outputs don't crash the pipeline.
     */
    private String normalizeOp(String raw) {
        if (raw == null) return "eq";
        String k = raw.toLowerCase().replaceAll("[_\\-\\s]", "");
        return switch (k) {
            case "eq","equals","equal","is","=="               -> "eq";
            case "ne","neq","notequal","notequals","isnot","!=" -> "ne";
            case "gt","greaterthan","greater","above",">"       -> "gt";
            case "lt","lessthan","less","below","<"             -> "lt";
            case "gte","greaterorequal","greaterthanorequal",">=" -> "gte";
            case "lte","lessorequal","lessthanorequal","<="     -> "lte";
            case "in","oneof","isoneof","isin","anyin","any"    -> "in";
            case "notin","notinlist","notinoneof","nin"         -> "not_in";
            case "contains","include","includes","ilike","like","matches" -> "contains";
            case "startswith","beginswith","startingwith"       -> "starts_with";
            case "endswith","endingwith"                        -> "ends_with";
            case "between","inrange","range"                    -> "between";
            case "isnull","null","isblank","blank","empty"      -> "is_null";
            case "notnull","isnotnull","notblank","isnotblank","notempty" -> "not_null";
            default -> raw; // pass through — unknown ops fall into the graceful default below
        };
    }

    private String buildConditionSql(JsonObject cond) {
        String col   = quoteName(cond.get("column").getAsString());
        String op    = normalizeOp(cond.has("op") ? cond.get("op").getAsString() : "eq");
        JsonElement val = cond.has("value") ? cond.get("value") : null;

        return switch (op) {
            case "eq"         -> col + " = "     + quoteLiteral(val);
            case "ne"         -> col + " != "    + quoteLiteral(val);
            case "gt"         -> col + " > "     + quoteLiteral(val);
            case "lt"         -> col + " < "     + quoteLiteral(val);
            case "gte"        -> col + " >= "    + quoteLiteral(val);
            case "lte"        -> col + " <= "    + quoteLiteral(val);
            case "in"         -> col + " IN "     + quoteLiteralList(val);
            case "not_in"     -> col + " NOT IN " + quoteLiteralList(val);
            case "contains"   -> "LOWER(" + col + ") LIKE LOWER(" + quoteLiteral("%" + strVal(val) + "%") + ")";
            case "starts_with"-> "LOWER(" + col + ") LIKE LOWER(" + quoteLiteral(strVal(val) + "%") + ")";
            case "ends_with"  -> "LOWER(" + col + ") LIKE LOWER(" + quoteLiteral("%" + strVal(val)) + ")";
            case "between"    -> {
                JsonArray arr = val != null && val.isJsonArray() ? val.getAsJsonArray() : new JsonArray();
                if (arr.size() >= 2) yield col + " BETWEEN " + quoteLiteral(arr.get(0)) + " AND " + quoteLiteral(arr.get(1));
                yield "1=1"; // malformed between — skip
            }
            case "is_null"  -> col + " IS NULL";
            case "not_null" -> col + " IS NOT NULL";
            default -> {
                // Unknown op: log a warning and emit a no-op so the rest of the query still runs
                System.err.println("[AnalysisService] unrecognised condition op '" + op + "' — skipping condition (using 1=1)");
                yield "1=1";
            }
        };
    }

    private String buildAggSql(JsonObject agg) {
        String fn    = agg.has("fn") ? agg.get("fn").getAsString().toUpperCase() : "COUNT";
        String col   = agg.has("column") ? agg.get("column").getAsString() : "*";
        String alias = agg.has("alias")  ? agg.get("alias").getAsString()
                     : fn + "_" + col;
        String colRef = "*".equals(col) ? "*" : quoteName(col);
        String aggExpr = "COUNT_DISTINCT".equals(fn)
            ? "COUNT(DISTINCT " + colRef + ")"
            : fn + "(" + colRef + ")";
        return aggExpr + " AS " + quoteName(alias);
    }

    // ── Quoting helpers ───────────────────────────────────────────────────────

    public String quoteName(String name) {
        return "\"" + name.replace("\"", "\"\"") + "\"";
    }

    private String quoteLiteral(JsonElement el) {
        if (el == null || el.isJsonNull()) return "NULL";
        if (el.isJsonPrimitive()) {
            if (el.getAsJsonPrimitive().isNumber()) return el.getAsString();
            if (el.getAsJsonPrimitive().isBoolean()) return el.getAsBoolean() ? "TRUE" : "FALSE";
            return "'" + el.getAsString().replace("'", "''") + "'";
        }
        return "NULL";
    }

    private String quoteLiteral(String s) {
        if (s == null) return "NULL";
        return "'" + s.replace("'", "''") + "'";
    }

    private String quoteLiteralList(JsonElement el) {
        if (el == null || !el.isJsonArray()) return "('')";
        JsonArray arr = el.getAsJsonArray();
        List<String> parts = new ArrayList<>();
        arr.forEach(e -> parts.add(quoteLiteral(e)));
        return "(" + String.join(", ", parts) + ")";
    }

    private String strVal(JsonElement el) {
        if (el == null || el.isJsonNull()) return "";
        return el.getAsString();
    }

    // ── Sort extraction ───────────────────────────────────────────────────────

    public List<Map<String, String>> extractSortFromStep(JsonObject step) {
        String op = step.has("op") ? step.get("op").getAsString() : "";
        return switch (op) {
            case "sort" -> {
                List<Map<String, String>> out = new ArrayList<>();
                if (step.has("by")) step.getAsJsonArray("by").forEach(b -> {
                    JsonObject bo = b.getAsJsonObject();
                    String dir = bo.has("direction") ? bo.get("direction").getAsString().toLowerCase() : "asc";
                    out.add(Map.of("field", bo.get("column").getAsString(), "direction", "asc".equals(dir) ? "asc" : "desc"));
                });
                yield out;
            }
            case "groupBy" -> {
                if (!step.has("sort")) yield List.of();
                JsonObject s = step.getAsJsonObject("sort");
                String dir = s.has("direction") ? s.get("direction").getAsString().toLowerCase() : "desc";
                yield List.of(Map.of("field", s.get("column").getAsString(), "direction", "asc".equals(dir) ? "asc" : "desc"));
            }
            case "topN" -> {
                String dir = step.has("direction") ? step.get("direction").getAsString().toLowerCase() : "desc";
                yield List.of(Map.of("field", step.get("column").getAsString(), "direction", "asc".equals(dir) ? "asc" : "desc"));
            }
            case "timeSeries" -> List.of(Map.of("field", "period", "direction", "asc"));
            default -> List.of();
        };
    }

    // ── Step validation (port of validateStepColumns + pruneInvalidSteps) ─────

    private List<String> getStepColumnRefs(JsonObject step) {
        String op = step.has("op") ? step.get("op").getAsString() : "";
        List<String> refs = new ArrayList<>();
        switch (op) {
            case "filter" -> {
                if (step.has("conditions")) step.getAsJsonArray("conditions")
                    .forEach(c -> { if (c.getAsJsonObject().has("column")) refs.add(c.getAsJsonObject().get("column").getAsString()); });
            }
            case "groupBy" -> {
                if (step.has("columns")) step.getAsJsonArray("columns").forEach(c -> refs.add(c.getAsString()));
                if (step.has("aggregations")) step.getAsJsonArray("aggregations").forEach(a -> {
                    String col = a.getAsJsonObject().has("column") ? a.getAsJsonObject().get("column").getAsString() : null;
                    if (col != null && !"*".equals(col)) refs.add(col);
                });
            }
            case "sort" -> { if (step.has("by")) step.getAsJsonArray("by").forEach(b -> { if (b.getAsJsonObject().has("column")) refs.add(b.getAsJsonObject().get("column").getAsString()); }); }
            case "select", "distinct" -> { if (step.has("columns")) step.getAsJsonArray("columns").forEach(c -> refs.add(c.getAsString())); }
            case "topN" -> { if (step.has("column")) refs.add(step.get("column").getAsString()); }
            case "timeSeries" -> {
                if (step.has("dateColumn")) refs.add(step.get("dateColumn").getAsString());
                if (step.has("aggregations")) step.getAsJsonArray("aggregations").forEach(a -> {
                    String col = a.getAsJsonObject().has("column") ? a.getAsJsonObject().get("column").getAsString() : null;
                    if (col != null && !"*".equals(col)) refs.add(col);
                });
            }
        }
        return refs;
    }

    private List<String> getStepOutputColumns(JsonObject step, List<String> inputCols) {
        String op = step.has("op") ? step.get("op").getAsString() : "";
        return switch (op) {
            case "filter", "sort", "topN" -> new ArrayList<>(inputCols);
            case "select", "distinct" -> {
                List<String> out = new ArrayList<>();
                if (step.has("columns")) step.getAsJsonArray("columns").forEach(c -> out.add(c.getAsString()));
                yield out;
            }
            case "groupBy" -> {
                List<String> out = new ArrayList<>();
                if (step.has("columns")) step.getAsJsonArray("columns").forEach(c -> out.add(c.getAsString()));
                if (step.has("aggregations")) step.getAsJsonArray("aggregations").forEach(a -> {
                    JsonObject ao = a.getAsJsonObject();
                    String fn  = ao.has("fn") ? ao.get("fn").getAsString().toUpperCase() : "COUNT";
                    String col = ao.has("column") ? ao.get("column").getAsString() : "*";
                    out.add(ao.has("alias") ? ao.get("alias").getAsString() : fn + "_" + col);
                });
                yield out;
            }
            case "timeSeries" -> {
                List<String> out = new ArrayList<>();
                out.add("period");
                if (step.has("aggregations")) step.getAsJsonArray("aggregations").forEach(a -> {
                    JsonObject ao = a.getAsJsonObject();
                    String fn  = ao.has("fn") ? ao.get("fn").getAsString().toUpperCase() : "COUNT";
                    String col = ao.has("column") ? ao.get("column").getAsString() : "*";
                    out.add(ao.has("alias") ? ao.get("alias").getAsString() : fn + "_" + col);
                });
                yield out;
            }
            case "compare" -> {
                List<String> out = new ArrayList<>();
                out.add("segment");
                if (step.has("metrics")) step.getAsJsonArray("metrics").forEach(m -> {
                    JsonObject mo = m.getAsJsonObject();
                    String fn  = mo.has("fn") ? mo.get("fn").getAsString().toUpperCase() : "COUNT";
                    String col = mo.has("column") ? mo.get("column").getAsString() : "*";
                    out.add(mo.has("alias") ? mo.get("alias").getAsString() : fn + "_" + col);
                });
                yield out;
            }
            default -> null; // pivot: dynamic
        };
    }

    public List<JsonObject> pruneInvalidSteps(List<JsonObject> steps, List<ColumnDef> schema) {
        Set<String> currentCols = schema.stream().map(ColumnDef::getField).collect(Collectors.toSet());
        List<JsonObject> valid = new ArrayList<>();
        for (JsonObject step : steps) {
            List<String> refs = getStepColumnRefs(step);
            // Capture a final snapshot per iteration so the lambda is happy
            final Set<String> snapshot = currentCols;
            List<String> missing = refs.stream().filter(r -> !snapshot.contains(r)).collect(Collectors.toList());
            if (!missing.isEmpty()) continue;
            valid.add(step);
            List<String> next = getStepOutputColumns(step, new ArrayList<>(currentCols));
            if (next != null) currentCols = new HashSet<>(next);
        }
        return valid;
    }

    public List<JsonObject> reorderStepPlan(List<JsonObject> steps, List<ColumnDef> schema) {
        Set<String> origCols = schema.stream().map(ColumnDef::getField).collect(Collectors.toSet());
        Set<String> AGG_OPS = Set.of("groupBy", "timeSeries", "pivot", "compare");
        List<JsonObject> preFilters = new ArrayList<>();
        List<JsonObject> rest = new ArrayList<>();
        for (JsonObject step : steps) {
            String op = step.has("op") ? step.get("op").getAsString() : "";
            if ("filter".equals(op)) {
                List<String> refs = getStepColumnRefs(step);
                if (!refs.isEmpty() && refs.stream().allMatch(origCols::contains)) {
                    preFilters.add(step);
                    continue;
                }
            }
            rest.add(step);
        }
        boolean hasAgg = rest.stream().anyMatch(s -> AGG_OPS.contains(s.has("op") ? s.get("op").getAsString() : ""));
        if (preFilters.isEmpty() || !hasAgg) return steps;
        List<JsonObject> result = new ArrayList<>(preFilters);
        result.addAll(rest);
        return result;
    }

    // ── Summary facts ─────────────────────────────────────────────────────────

    public Map<String, Object> computeSummaryFacts(List<String> columns, List<Map<String, Object>> rows, List<JsonObject> steps) {
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("resultRowCount", rows.size());

        Map<String, Integer> distinct = new LinkedHashMap<>();
        for (String col : columns) {
            Set<Object> seen = new HashSet<>();
            rows.forEach(r -> { Object v = r.get(col); if (v != null && !"".equals(v)) seen.add(v); });
            distinct.put(col, seen.size());
        }
        facts.put("distinctCounts", distinct);

        JsonObject lastGroupBy = null;
        for (int i = steps.size() - 1; i >= 0; i--) {
            if ("groupBy".equals(steps.get(i).has("op") ? steps.get(i).get("op").getAsString() : "")) {
                lastGroupBy = steps.get(i);
                break;
            }
        }

        if (lastGroupBy != null && !rows.isEmpty() && lastGroupBy.has("sort")) {
            String metricCol = lastGroupBy.getAsJsonObject("sort").get("column").getAsString();
            String groupCol  = lastGroupBy.has("columns") && lastGroupBy.getAsJsonArray("columns").size() > 0
                ? lastGroupBy.getAsJsonArray("columns").get(0).getAsString() : null;
            if (rows.get(0).containsKey(metricCol)) {
                facts.put("groupColumn",      groupCol);
                facts.put("metricColumn",     metricCol);
                facts.put("topGroup",         rows.get(0).get(groupCol));
                facts.put("topValue",         rows.get(0).get(metricCol));
                facts.put("runnerUpGroup",    rows.size() > 1 ? rows.get(1).get(groupCol) : null);
                facts.put("runnerUpValue",    rows.size() > 1 ? rows.get(1).get(metricCol) : null);
                facts.put("distinctGroupCount", distinct.getOrDefault(groupCol, rows.size()));
            }
        }

        return facts;
    }
}
