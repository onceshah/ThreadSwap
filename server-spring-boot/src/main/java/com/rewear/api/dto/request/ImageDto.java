package com.rewear.api.dto.request;

public class ImageDto {
    private String url;
    private String publicId;
    private int sortOrder;

    public ImageDto() {}

    public ImageDto(String url, String publicId, int sortOrder) {
        this.url = url;
        this.publicId = publicId;
        this.sortOrder = sortOrder;
    }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getPublicId() { return publicId; }
    public void setPublicId(String publicId) { this.publicId = publicId; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
