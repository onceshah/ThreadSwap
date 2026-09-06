package com.rewear.api.dto.request;

public class AiSearchRequestDto {
    private String query;
    private Double maxPrice;
    private String category;

    public AiSearchRequestDto() {}

    public AiSearchRequestDto(String query, Double maxPrice, String category) {
        this.query = query;
        this.maxPrice = maxPrice;
        this.category = category;
    }

    public String getQuery() { return query; }
    public void setQuery(String query) { this.query = query; }

    public Double getMaxPrice() { return maxPrice; }
    public void setMaxPrice(Double maxPrice) { this.maxPrice = maxPrice; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
}
