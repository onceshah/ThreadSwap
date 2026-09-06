package com.rewear.api.entity;

import java.time.Instant;
import java.util.UUID;

public class ProductImage {

    private UUID id = UUID.randomUUID();

    private String url;

    private String publicId;

    private Integer sortOrder = 0;

    private Instant createdAt = Instant.now();

    public ProductImage() {}

    public ProductImage(String url, String publicId, int sortOrder) {
        this.url = url;
        this.publicId = publicId;
        this.sortOrder = sortOrder;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getPublicId() { return publicId; }
    public void setPublicId(String publicId) { this.publicId = publicId; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
