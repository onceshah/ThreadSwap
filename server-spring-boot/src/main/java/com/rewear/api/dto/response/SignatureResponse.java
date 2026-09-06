package com.rewear.api.dto.response;

public class SignatureResponse {
    private String signature;
    private long timestamp;
    private String apiKey;
    private String cloudName;

    public SignatureResponse(String signature, long timestamp, String apiKey, String cloudName) {
        this.signature = signature;
        this.timestamp = timestamp;
        this.apiKey = apiKey;
        this.cloudName = cloudName;
    }

    public String getSignature() { return signature; }
    public void setSignature(String signature) { this.signature = signature; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public String getCloudName() { return cloudName; }
    public void setCloudName(String cloudName) { this.cloudName = cloudName; }
}
