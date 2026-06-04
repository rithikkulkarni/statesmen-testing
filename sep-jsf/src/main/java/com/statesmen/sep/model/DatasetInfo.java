package com.statesmen.sep.model;

import java.util.List;
import java.util.Map;

public class DatasetInfo {

    private final String id;
    private final String label;
    private final List<ColumnDef> columns;
    private final List<Map<String, Object>> rows;

    public DatasetInfo(String id, String label, List<ColumnDef> columns, List<Map<String, Object>> rows) {
        this.id = id;
        this.label = label;
        this.columns = columns;
        this.rows = rows;
    }

    public String getId() { return id; }
    public String getLabel() { return label; }
    public List<ColumnDef> getColumns() { return columns; }
    public List<Map<String, Object>> getRows() { return rows; }
}
