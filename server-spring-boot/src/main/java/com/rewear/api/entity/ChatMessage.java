package com.rewear.api.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import java.time.Instant;

/**
 * Simple flat chat message stored by threadKey = "seller::productId".
 * No complex user references — works even without authentication.
 */
@Document(collection = "chat_messages")
public class ChatMessage {

    @Id
    private String id;

    @Indexed
    private String threadKey; // e.g. "Meera K.::product-abc123"

    private String senderName;
    private String senderEmail;
    private String text;
    private Instant sentAt = Instant.now();
    private boolean fromMe; // relative to senderName

    public ChatMessage() {}

    public ChatMessage(String threadKey, String senderName, String text) {
        this.threadKey = threadKey;
        this.senderName = senderName;
        this.text = text;
        this.sentAt = Instant.now();
    }

    public ChatMessage(String threadKey, String senderName, String senderEmail, String text) {
        this.threadKey = threadKey;
        this.senderName = senderName;
        this.senderEmail = senderEmail;
        this.text = text;
        this.sentAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getThreadKey() { return threadKey; }
    public void setThreadKey(String threadKey) { this.threadKey = threadKey; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getSenderEmail() { return senderEmail; }
    public void setSenderEmail(String senderEmail) { this.senderEmail = senderEmail; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public Instant getSentAt() { return sentAt; }
    public void setSentAt(Instant sentAt) { this.sentAt = sentAt; }

    public boolean isFromMe() { return fromMe; }
    public void setFromMe(boolean fromMe) { this.fromMe = fromMe; }
}
