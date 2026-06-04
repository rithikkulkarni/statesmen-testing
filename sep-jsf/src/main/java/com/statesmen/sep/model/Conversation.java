package com.statesmen.sep.model;

import java.io.Serializable;
import java.util.List;

public class Conversation implements Serializable {

    private final String id;
    private String       name;
    private final String createdAt;
    private List<ChatMessage> messages;

    public Conversation(String id, String name, String createdAt, List<ChatMessage> messages) {
        this.id        = id;
        this.name      = name;
        this.createdAt = createdAt;
        this.messages  = messages;
    }

    public String            getId()                          { return id; }
    public String            getName()                        { return name; }
    public void              setName(String name)             { this.name = name; }
    public String            getCreatedAt()                   { return createdAt; }
    public List<ChatMessage> getMessages()                    { return messages; }
    public void              setMessages(List<ChatMessage> m) { this.messages = m; }
}
