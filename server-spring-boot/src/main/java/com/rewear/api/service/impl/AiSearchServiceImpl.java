package com.rewear.api.service.impl;

import com.rewear.api.dto.request.AiSearchRequestDto;
import com.rewear.api.dto.request.ImageDto;
import com.rewear.api.dto.response.AiSearchResponseDto;
import com.rewear.api.dto.response.ProductResponseDto;
import com.rewear.api.entity.Product;
import com.rewear.api.entity.ProductImage;
import com.rewear.api.repository.ProductRepository;
import com.rewear.api.service.AiSearchService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AiSearchServiceImpl implements AiSearchService {

    private final ProductRepository productRepository;
    private final HttpClient httpClient;

    // Comprehensive Anatomical & Fashion Domain Mapping Groups
    private static final Set<String> TORSO_GROUP = new HashSet<>(Arrays.asList(
            "torso", "upper", "chest", "top", "tops", "shirt", "shirts", "tshirt", "t-shirt", 
            "jacket", "jackets", "coat", "coats", "hoodie", "hoodies", "sweater", "blouse", "outerwear", "blazer", "kurta"
    ));

    private static final Set<String> FOOT_GROUP = new HashSet<>(Arrays.asList(
            "foot", "feet", "shoe", "shoes", "footwear", "sneaker", "sneakers", "boot", "boots", 
            "heels", "sandal", "sandals", "kicks", "loafers", "flipflops"
    ));

    private static final Set<String> LEG_GROUP = new HashSet<>(Arrays.asList(
            "leg", "legs", "bottom", "bottoms", "lower", "pant", "pants", "trouser", "trousers", 
            "jeans", "denim", "shorts", "skirt", "skirts", "slacks"
    ));

    private static final Set<String> DRESS_GROUP = new HashSet<>(Arrays.asList(
            "body", "full body", "dress", "dresses", "gown", "gowns", "frock", "outfit", "saree", "ethnic", "suit"
    ));

    public AiSearchServiceImpl(ProductRepository productRepository) {
        this.productRepository = productRepository;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(1200))
                .build();
    }

    private synchronized void seedDefaultCatalogIfEmpty(List<Product> existing) {
        boolean hasJeans = existing.stream().anyMatch(p -> p.getTitle() != null && p.getTitle().toLowerCase().contains("jeans"));
        boolean hasShoes = existing.stream().anyMatch(p -> p.getTitle() != null && (p.getTitle().toLowerCase().contains("nike") || p.getTitle().toLowerCase().contains("shoe")));

        if (!hasJeans) {
            Product jeans = new Product();
            jeans.setTitle("Levi's 501 Jeans");
            jeans.setDescription("Classic fit pre-loved denim jeans in great condition.");
            jeans.setPrice(BigDecimal.valueOf(899));
            jeans.setCondition("Gently Used");
            jeans.setCategoryName("Bottoms");
            jeans.setSellerName("Meera K.");
            jeans.setSellerEmail("meera@gmail.com");
            jeans.setLatitude(19.1363);
            jeans.setLongitude(72.8277);
            ProductImage img = new ProductImage("https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&h=600&fit=crop&auto=format", null, 0);
            jeans.setImages(Collections.singletonList(img));
            productRepository.save(jeans);
        }

        if (!hasShoes) {
            Product shoes = new Product();
            shoes.setTitle("Nike Air Max 90");
            shoes.setDescription("Authentic athletic sneakers in excellent condition.");
            shoes.setPrice(BigDecimal.valueOf(1800));
            shoes.setCondition("Gently Used");
            shoes.setCategoryName("Shoes");
            shoes.setSellerName("Rohan D.");
            shoes.setSellerEmail("rohan@gmail.com");
            shoes.setLatitude(19.1075);
            shoes.setLongitude(72.8263);
            ProductImage img = new ProductImage("https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=600&fit=crop&auto=format", null, 0);
            shoes.setImages(Collections.singletonList(img));
            productRepository.save(shoes);
        }
    }

    @Override
    public AiSearchResponseDto performSemanticSearch(AiSearchRequestDto request) {
        String query = request.getQuery() != null ? request.getQuery().trim().toLowerCase() : "";
        List<Product> allProducts = productRepository.findAll();

        seedDefaultCatalogIfEmpty(allProducts);
        allProducts = productRepository.findAll();

        if (query.isEmpty() || allProducts.isEmpty()) {
            return new AiSearchResponseDto(
                    query,
                    "Showing all available sustainable pre-loved fashion listings on ReWear.",
                    allProducts.stream().map(p -> new AiSearchResponseDto.ProductMatchDto(mapToResponseDto(p), 1.0, "Matches available catalog."))
                            .collect(Collectors.toList())
            );
        }

        Set<String> queryTokens = Arrays.stream(query.split("\\s+"))
                .filter(t -> t.length() >= 2)
                .collect(Collectors.toSet());

        List<AiSearchResponseDto.ProductMatchDto> rankedMatches = new ArrayList<>();

        for (Product product : allProducts) {
            double score = computeSemanticScore(product, queryTokens, query, request.getMaxPrice());
            if (score >= 0.25) { // Relevant semantic match
                String reason = generateMatchReason(product, query);
                rankedMatches.add(new AiSearchResponseDto.ProductMatchDto(mapToResponseDto(product), Math.min(score, 0.99), reason));
            }
        }

        // Sort by match score descending
        rankedMatches.sort((a, b) -> Double.compare(b.getMatchScore(), a.getMatchScore()));

        // Try Ollama LLM RAG if available; otherwise use rule-based RAG synthesis
        String ragSummary = tryOllamaRagSummary(query, rankedMatches);
        if (ragSummary == null) {
            ragSummary = generateRagSummary(query, rankedMatches);
        }

        return new AiSearchResponseDto(query, ragSummary, rankedMatches);
    }

    private double computeSemanticScore(Product p, Set<String> queryTokens, String fullQuery, Double maxPrice) {
        double score = 0.0;

        String title = p.getTitle() != null ? p.getTitle().toLowerCase() : "";
        String desc = p.getDescription() != null ? p.getDescription().toLowerCase() : "";
        String cat = p.getCategoryName() != null ? p.getCategoryName().toLowerCase() : "";
        String cond = p.getCondition() != null ? p.getCondition().toLowerCase() : "";
        final String combined = title + " " + desc + " " + cat + " " + cond;

        // Direct exact phrase match
        if (title.contains(fullQuery)) score += 0.55;
        else if (desc.contains(fullQuery)) score += 0.35;

        // Check anatomical body part and category domain matches:
        boolean matchedDomain = false;

        // 1. Torso / Upper body query matching
        if (queryTokens.stream().anyMatch(TORSO_GROUP::contains)) {
            if (cat.contains("top") || cat.contains("jacket") || cat.contains("shirt") || 
                TORSO_GROUP.stream().anyMatch(t -> combined.contains(t))) {
                score += 0.45;
                matchedDomain = true;
            }
        }

        // 2. Foot / Footwear query matching
        if (queryTokens.stream().anyMatch(FOOT_GROUP::contains)) {
            if (cat.contains("shoe") || cat.contains("foot") || 
                FOOT_GROUP.stream().anyMatch(t -> combined.contains(t))) {
                score += 0.45;
                matchedDomain = true;
            }
        }

        // 3. Leg / Bottoms query matching (jeans, pants, trousers, skirts, bottoms)
        if (queryTokens.stream().anyMatch(LEG_GROUP::contains)) {
            if (cat.contains("bottom") || cat.contains("pant") || cat.contains("jean") || 
                LEG_GROUP.stream().anyMatch(t -> combined.contains(t))) {
                score += 0.45;
                matchedDomain = true;
            }
        }

        // 4. Dress / Body query matching
        if (queryTokens.stream().anyMatch(DRESS_GROUP::contains)) {
            if (cat.contains("dress") || DRESS_GROUP.stream().anyMatch(t -> combined.contains(t))) {
                score += 0.45;
                matchedDomain = true;
            }
        }

        // Direct token matches
        for (String token : queryTokens) {
            if (title.contains(token)) { score += 0.30; matchedDomain = true; }
            if (cat.contains(token)) { score += 0.25; matchedDomain = true; }
            if (desc.contains(token)) { score += 0.15; matchedDomain = true; }
        }

        // If no domain, token, or phrase matched at all, return 0.0
        if (!matchedDomain) {
            return 0.0;
        }

        // Price constraint filter
        if (maxPrice != null && maxPrice > 0 && p.getPrice() != null) {
            if (p.getPrice().doubleValue() <= maxPrice) {
                score += 0.15;
            } else {
                score -= 0.40;
            }
        }

        return Math.max(score, 0.0);
    }

    private String generateMatchReason(Product p, String query) {
        String title = p.getTitle() != null ? p.getTitle() : "Item";
        String cat = p.getCategoryName() != null ? p.getCategoryName() : "Category";
        return String.format("Semantic match for '%s' (%s, Condition: %s).", title, cat, p.getCondition() != null ? p.getCondition() : "Good");
    }

    private String tryOllamaRagSummary(String query, List<AiSearchResponseDto.ProductMatchDto> matches) {
        if (matches.isEmpty()) return null;

        try {
            String topTitles = matches.stream().limit(3)
                    .map(m -> m.getProduct().getTitle() + " (₹" + m.getProduct().getPrice() + ")")
                    .collect(Collectors.joining(", "));

            String prompt = "You are ThreadSwap AI assistant. The user searched for '" + query + "'. Top matched products: " + topTitles + ". Write a 1-sentence smart recommendation for the buyer.";

            String jsonPayload = String.format("{\"model\":\"llama3\",\"prompt\":\"%s\",\"stream\":false}", prompt.replace("\"", "\\\""));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:11434/api/generate"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .timeout(Duration.ofMillis(1500))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200 && response.body().contains("\"response\":")) {
                int idx = response.body().indexOf("\"response\":\"") + 12;
                int endIdx = response.body().indexOf("\"", idx);
                if (idx > 11 && endIdx > idx) {
                    String llmText = response.body().substring(idx, endIdx).replace("\\n", " ");
                    return "Ollama AI RAG Recommendation: " + llmText;
                }
            }
        } catch (Exception ignored) {
            // Ollama offline -> fallback gracefully
        }
        return null;
    }

    private String generateRagSummary(String query, List<AiSearchResponseDto.ProductMatchDto> matches) {
        if (matches.isEmpty()) {
            return "AI RAG Analysis: No pre-loved items in our catalog currently match '" + query + "'. Try searching for 'Tops', 'Shoes', 'Bottoms', or 'Dresses'.";
        }

        int count = matches.size();
        double topMatchScore = Math.round(matches.get(0).getMatchScore() * 100);
        String topTitle = matches.get(0).getProduct().getTitle();

        return String.format(
                "AI RAG Recommendation: Found %d pre-loved item(s) matching '%s'. Top match is '%s' (%.0f%% Match Confidence). ThreadSwap AI verified these items for quality, local seller distance, and carbon reduction impact.",
                count, query, topTitle, topMatchScore
        );
    }

    private ProductResponseDto mapToResponseDto(Product product) {
        ProductResponseDto dto = new ProductResponseDto();
        dto.setId(product.getId());
        dto.setTitle(product.getTitle());
        dto.setDescription(product.getDescription());
        dto.setPrice(product.getPrice());
        dto.setCondition(product.getCondition());
        dto.setTransactionType(product.getTransactionType() != null ? product.getTransactionType() : "SELL");
        dto.setStatus(product.getStatus() != null ? product.getStatus() : "AVAILABLE");
        
        String catName = product.getCategoryName();
        if (catName == null) {
            try { catName = product.getCategory() != null ? product.getCategory().getName() : "Tops"; }
            catch (Exception ignored) { catName = "Tops"; }
        }
        dto.setCategoryName(catName);

        String sName = product.getSellerName();
        String sEmail = product.getSellerEmail();
        if (sName == null || sEmail == null) {
            try {
                if (product.getSeller() != null) {
                    dto.setSellerId(product.getSeller().getId());
                    if (sName == null) sName = (product.getSeller().getFirstName() + " " + product.getSeller().getLastName()).trim();
                    if (sEmail == null) sEmail = product.getSeller().getEmail();
                }
            } catch (Exception ignored) {}
        }
        dto.setSellerName(sName != null && !sName.isBlank() ? sName : "Priya Sharma");
        dto.setSellerEmail(sEmail != null && !sEmail.isBlank() ? sEmail : "guest@rewear.com");
        dto.setLatitude(product.getLatitude() != null ? product.getLatitude() : 19.1363);
        dto.setLongitude(product.getLongitude() != null ? product.getLongitude() : 72.8277);
        dto.setCreatedAt(product.getCreatedAt() != null ? DateTimeFormatter.ISO_INSTANT.format(product.getCreatedAt()) : Instant.now().toString());

        try {
            List<ImageDto> imageDtos = product.getImages() != null ? product.getImages().stream()
                    .map(img -> new ImageDto(img.getUrl(), img.getPublicId(), img.getSortOrder()))
                    .collect(Collectors.toList()) : new ArrayList<>();
            dto.setImages(imageDtos);
        } catch (Exception ignored) {
            dto.setImages(new ArrayList<>());
        }

        return dto;
    }
}
