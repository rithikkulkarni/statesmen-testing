package com.statesmen.sep.model;

import java.io.Serializable;

/**
 * Holds a Chart.js config JSON string that is passed to the browser
 * via a hidden DOM element and rendered with new Chart(canvas, config).
 * This bypasses the PrimeFaces chart component (which doesn't render
 * reliably inside ui:repeat) and uses Chart.js directly.
 */
public class ChartResult implements Serializable {

    private final String chartJson;

    public ChartResult(String chartJson) {
        this.chartJson = chartJson;
    }

    public String getChartJson() { return chartJson; }
}
