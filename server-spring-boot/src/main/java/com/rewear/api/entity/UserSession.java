package com.rewear.api.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DocumentReference;
import java.time.Instant;
import java.util.UUID;

@Document(collection = "user_sessions")
public class UserSession {

    @Id
    private UUID id = UUID.randomUUID();

    @DocumentReference
    private User user;

    private String refreshToken;

    private String jti;

    private String clientIp;

    private String userAgent;

    private Boolean isRevoked = false;

    private Instant expiresAt;

    private Instant createdAt = Instant.now();

    private Instant lastActiveAt = Instant.now();

    public UserSession() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getRefreshToken() { return refreshToken; }
    public void setRefreshToken(String refreshToken) { this.refreshToken = refreshToken; }

    public String getJti() { return jti; }
    public void setJti(String jti) { this.jti = jti; }

    public String getClientIp() { return clientIp; }
    public void setClientIp(String clientIp) { this.clientIp = clientIp; }

    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }

    public Boolean getRevoked() { return isRevoked; }
    public void setRevoked(Boolean revoked) { isRevoked = revoked; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getLastActiveAt() { return lastActiveAt; }
    public void setLastActiveAt(Instant lastActiveAt) { this.lastActiveAt = lastActiveAt; }
}
