package com.rewear.api.dto.request;

public class SignatureRequest {
    private String folder = "products";

    public SignatureRequest() {}

    public String getFolder() { return folder; }
    public void setFolder(String folder) { this.folder = folder; }
}
