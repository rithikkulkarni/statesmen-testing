package com.statesmen.sep.model;

import java.io.Serializable;

public class ChatMessage implements Serializable {

    private String      role;
    private String      title;
    private String      rawContent;
    private String      htmlContent;
    private ChartResult chartResult;  // null when there is no chart for this message
    private String      snapshotId;   // key into AppBean.querySnapshots; null only for clarification messages

    public ChatMessage(String role, String title, String rawContent, String htmlContent) {
        this.role        = role;
        this.title       = title;
        this.rawContent  = rawContent;
        this.htmlContent = htmlContent;
    }

    public ChatMessage withChart(ChartResult chart) {
        this.chartResult = chart;
        return this;
    }

    public String      getRole()        { return role; }
    public String      getTitle()       { return title; }
    public String      getRawContent()  { return rawContent; }
    public String      getHtmlContent() { return htmlContent; }
    public ChartResult getChartResult() { return chartResult; }
    public String      getSnapshotId()  { return snapshotId; }
    public void        setSnapshotId(String id) { this.snapshotId = id; }
}
