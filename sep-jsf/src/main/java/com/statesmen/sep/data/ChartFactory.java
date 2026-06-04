package com.statesmen.sep.data;

import com.google.gson.*;
import com.statesmen.sep.model.ChartResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Builds Chart.js 4.x config JSON from SQL result sets.
 * The JSON is stored in AppBean and rendered via a <canvas> element
 * using Chart.js directly — no PrimeFaces chart component involved.
 *
 * Type selection:
 *   "period" column  → line chart (time series)
 *   "segment" column → bar chart  (compare)
 *   ≤ 6 rows, 1 num  → pie chart
 *   everything else  → bar chart
 */
@Named
@ApplicationScoped
public class ChartFactory {

    private static final List<String> SOLID = List.of(
        "#4f6ef7","#10b981","#f59e0b","#ef4444","#8b5cf6",
        "#06b6d4","#f97316","#ec4899","#14b8a6","#84cc16"
    );
    private static final List<String> ALPHA = List.of(
        "rgba(79,110,247,0.75)","rgba(16,185,129,0.75)","rgba(245,158,11,0.75)",
        "rgba(239,68,68,0.75)", "rgba(139,92,246,0.75)","rgba(6,182,212,0.75)",
        "rgba(249,115,22,0.75)","rgba(236,72,153,0.75)","rgba(20,184,166,0.75)",
        "rgba(132,204,22,0.75)"
    );

    // ── Entry point ───────────────────────────────────────────────────────────

    public ChartResult create(List<String> columns, List<Map<String, Object>> rows, String requestedType) {
        if (columns == null || rows == null || columns.isEmpty() || rows.isEmpty()) return null;
        if (rows.size() > 40) return null;

        // Determine label and numeric columns regardless of chart type
        String labelCol;
        List<String> nums;
        if (columns.contains("period")) {
            labelCol = "period";
            nums = numericCols(columns, rows, Set.of("period"));
        } else if (columns.contains("segment")) {
            labelCol = "segment";
            nums = numericCols(columns, rows, Set.of("segment"));
        } else {
            labelCol = labelCol(columns, rows);
            nums = numericCols(columns, rows, labelCol != null ? Set.of(labelCol) : Set.of());
        }
        if (labelCol == null || nums.isEmpty()) return null;

        // Honour explicit user request — never override what they asked for
        if (requestedType != null) {
            return switch (requestedType.toLowerCase()) {
                case "pie"      -> buildPie(rows, labelCol, nums.get(0), "pie");
                case "doughnut" -> buildPie(rows, labelCol, nums.get(0), "doughnut");
                case "line"     -> buildLine(rows, labelCol, nums.get(0));
                default         -> buildBar(rows, labelCol, nums); // "bar" and anything unrecognised
            };
        }

        // Auto-select based on data shape
        if (columns.contains("period")) {
            String num = firstNumeric(columns, rows, Set.of("period"));
            return num != null ? buildLine(rows, "period", num) : null;
        }
        if (columns.contains("segment")) {
            return buildBar(rows, "segment", numericCols(columns, rows, Set.of("segment")));
        }
        if (rows.size() <= 6 && nums.size() == 1) return buildPie(rows, labelCol, nums.get(0), "pie");
        return buildBar(rows, labelCol, nums);
    }

    // ── Bar ───────────────────────────────────────────────────────────────────

    private ChartResult buildBar(List<Map<String, Object>> rows, String labelCol, List<String> valueCols) {
        JsonArray labels   = labelsArray(rows, labelCol);
        JsonArray datasets = new JsonArray();

        int max = Math.min(valueCols.size(), 3);
        for (int i = 0; i < max; i++) {
            String col = valueCols.get(i);
            JsonObject ds = new JsonObject();
            ds.addProperty("label", header(col));
            ds.add("data", dataArray(rows, col));
            if (max == 1) {
                // one dataset → each bar gets its own colour
                ds.add("backgroundColor", paletteArray(rows.size(), ALPHA));
                ds.add("borderColor",      paletteArray(rows.size(), SOLID));
            } else {
                ds.addProperty("backgroundColor", ALPHA.get(i % ALPHA.size()));
                ds.addProperty("borderColor",      SOLID.get(i % SOLID.size()));
            }
            ds.addProperty("borderWidth", 1);
            ds.addProperty("borderRadius", 3);
            datasets.add(ds);
        }

        JsonObject data = new JsonObject();
        data.add("labels", labels);
        data.add("datasets", datasets);

        return new ChartResult(config("bar", data));
    }

    // ── Line ──────────────────────────────────────────────────────────────────

    private ChartResult buildLine(List<Map<String, Object>> rows, String labelCol, String valueCol) {
        JsonObject ds = new JsonObject();
        ds.addProperty("label",           header(valueCol));
        ds.add("data",                    dataArray(rows, valueCol));
        ds.addProperty("borderColor",     SOLID.get(0));
        ds.addProperty("backgroundColor", "rgba(79,110,247,0.12)");
        ds.addProperty("fill",            true);
        ds.addProperty("tension",         0.35);
        ds.addProperty("pointRadius",     3);

        JsonArray datasets = new JsonArray(); datasets.add(ds);
        JsonObject data = new JsonObject();
        data.add("labels",   labelsArray(rows, labelCol));
        data.add("datasets", datasets);

        return new ChartResult(config("line", data));
    }

    // ── Pie ───────────────────────────────────────────────────────────────────

    private ChartResult buildPie(List<Map<String, Object>> rows, String labelCol, String valueCol, String type) {
        JsonObject ds = new JsonObject();
        ds.add("data",            dataArray(rows, valueCol));
        ds.add("backgroundColor", paletteArray(rows.size(), ALPHA));
        ds.add("borderColor",     paletteArray(rows.size(), SOLID));
        ds.addProperty("borderWidth", 1);

        JsonArray datasets = new JsonArray(); datasets.add(ds);
        JsonObject data = new JsonObject();
        data.add("labels",   labelsArray(rows, labelCol));
        data.add("datasets", datasets);

        return new ChartResult(config(type != null ? type : "pie", data));
    }

    // ── Config skeleton — options are injected client-side by renderSepChart() ─

    private static final Gson PRETTY = new GsonBuilder().setPrettyPrinting().create();

    private String config(String type, JsonObject data) {
        JsonObject cfg = new JsonObject();
        cfg.addProperty("type", type);
        cfg.add("data", data);
        return PRETTY.toJson(cfg);
    }

    // ── Column detection ──────────────────────────────────────────────────────

    private String labelCol(List<String> columns, List<Map<String, Object>> rows) {
        return columns.stream().filter(c -> {
            Object v = rows.stream().map(r -> r.get(c)).filter(Objects::nonNull).findFirst().orElse(null);
            return v != null && !(v instanceof Number);
        }).findFirst().orElse(null);
    }

    private String firstNumeric(List<String> cols, List<Map<String, Object>> rows, Set<String> excl) {
        return cols.stream().filter(c -> !excl.contains(c) && isNum(c, rows)).findFirst().orElse(null);
    }

    private List<String> numericCols(List<String> cols, List<Map<String, Object>> rows, Set<String> excl) {
        return cols.stream().filter(c -> !excl.contains(c) && isNum(c, rows)).collect(Collectors.toList());
    }

    private boolean isNum(String col, List<Map<String, Object>> rows) {
        return rows.stream().map(r -> r.get(col)).filter(Objects::nonNull)
            .findFirst().map(v -> v instanceof Number).orElse(false);
    }

    // ── JSON helpers ──────────────────────────────────────────────────────────

    private JsonArray labelsArray(List<Map<String, Object>> rows, String col) {
        JsonArray arr = new JsonArray();
        rows.forEach(r -> arr.add(r.get(col) == null ? "" : r.get(col).toString()));
        return arr;
    }

    private JsonArray dataArray(List<Map<String, Object>> rows, String col) {
        JsonArray arr = new JsonArray();
        rows.forEach(r -> arr.add(r.get(col) instanceof Number
            ? Math.round(((Number) r.get(col)).doubleValue() * 100.0) / 100.0 : 0.0));
        return arr;
    }

    private JsonArray paletteArray(int size, List<String> palette) {
        JsonArray arr = new JsonArray();
        for (int i = 0; i < size; i++) arr.add(palette.get(i % palette.size()));
        return arr;
    }

    private String header(String field) {
        return field.replaceAll("([A-Z])", " $1").replace("_", " ").trim();
    }
}
