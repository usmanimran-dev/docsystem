package com.edms.examination.model;

public class ManualExtractionData {
    private String id;
    private String text;
    private int x1, y1, x2, y2;
    private String timestamp;

    public ManualExtractionData() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public int getX1() { return x1; }
    public void setX1(int x1) { this.x1 = x1; }

    public int getY1() { return y1; }
    public void setY1(int y1) { this.y1 = y1; }

    public int getX2() { return x2; }
    public void setX2(int x2) { this.x2 = x2; }

    public int getY2() { return y2; }
    public void setY2(int y2) { this.y2 = y2; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
}
