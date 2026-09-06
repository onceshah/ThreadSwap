package com.rewear.api.dto.response;

import java.util.List;

public class AiSearchResponseDto {
    private String query;
    private String ragSummary;
    private List<ProductMatchDto> results;

    public AiSearchResponseDto() {}

    public AiSearchResponseDto(String query, String ragSummary, List<ProductMatchDto> results) {
        this.query = query;
        this.ragSummary = ragSummary;
        this.results = results;
    }

    public String getQuery() { return query; }
    public void setQuery(String query) { this.query = query; }

    public String getRagSummary() { return ragSummary; }
    public void setRagSummary(String ragSummary) { this.ragSummary = ragSummary; }

    public List<ProductMatchDto> getResults() { return results; }
    public void setResults(List<ProductMatchDto> results) { this.results = results; }

    public static class ProductMatchDto {
        private ProductResponseDto product;
        private double matchScore; // e.g. 0.95 (95%)
        private String matchReason;

        public ProductMatchDto() {}

        public ProductMatchDto(ProductResponseDto product, double matchScore, String matchReason) {
            this.product = product;
            this.matchScore = matchScore;
            this.matchReason = matchReason;
        }

        public ProductResponseDto getProduct() { return product; }
        public void setProduct(ProductResponseDto product) { this.product = product; }

        public double getMatchScore() { return matchScore; }
        public void setMatchScore(double matchScore) { this.matchScore = matchScore; }

        public String getMatchReason() { return matchReason; }
        public void setMatchReason(String matchReason) { this.matchReason = matchReason; }
    }
}
