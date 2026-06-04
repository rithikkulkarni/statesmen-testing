package com.statesmen.sep.model;

import java.io.Serializable;

public class ColumnDef implements Serializable {

    private String field;
    private String headerText;
    private boolean numeric;
    private boolean currency;
    private boolean visible = true;
    private int width;

    public ColumnDef() {}

    public ColumnDef(String field, String headerText, boolean numeric, boolean currency) {
        this.field = field;
        this.headerText = headerText;
        this.numeric = numeric;
        this.currency = currency;
    }

    public String getFilterMatchMode() {
        // "contains" works for both text and numbers — PrimeFaces compares
        // against the string representation, matching AG Grid's default behaviour.
        return "contains";
    }

    public String getField() { return field; }
    public void setField(String field) { this.field = field; }

    public String getHeaderText() { return headerText; }
    public void setHeaderText(String headerText) { this.headerText = headerText; }

    public boolean isNumeric() { return numeric; }
    public void setNumeric(boolean numeric) { this.numeric = numeric; }

    public boolean isCurrency() { return currency; }
    public void setCurrency(boolean currency) { this.currency = currency; }

    public boolean isVisible() { return visible; }
    public void setVisible(boolean visible) { this.visible = visible; }

    public int getWidth() { return width; }
    public void setWidth(int width) { this.width = width; }
}
