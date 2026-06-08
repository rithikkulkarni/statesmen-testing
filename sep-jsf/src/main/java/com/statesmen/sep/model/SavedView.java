package com.statesmen.sep.model;

import java.io.Serializable;

public class SavedView implements Serializable {

    private final String id;
    private       String name;
    private       String configJson;
    private       String chartJson;
    private       String chartTitle;

    public SavedView(String id, String name, String configJson, String chartJson, String chartTitle) {
        this.id         = id;
        this.name       = name;
        this.configJson = configJson;
        this.chartJson  = chartJson;
        this.chartTitle = chartTitle;
    }

    public String getId()         { return id; }
    public String getName()       { return name; }
    public String getConfigJson() { return configJson; }
    public String getChartJson()  { return chartJson; }
    public String getChartTitle() { return chartTitle; }

    public void setName(String name)        { this.name = name; }
    public void setConfigJson(String json)  { this.configJson = json; }
    public void setChartJson(String json)   { this.chartJson = json; }
    public void setChartTitle(String title) { this.chartTitle = title; }
}
