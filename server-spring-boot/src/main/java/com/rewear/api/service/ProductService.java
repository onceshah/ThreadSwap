package com.rewear.api.service;

import com.rewear.api.dto.request.ProductRequestDto;
import com.rewear.api.dto.response.ProductResponseDto;
import java.util.List;
import java.util.UUID;

public interface ProductService {
    ProductResponseDto createProduct(ProductRequestDto request, UUID sellerId);
    List<ProductResponseDto> getNearbyProducts(double latitude, double longitude, double radiusKm);
    List<ProductResponseDto> getAllProducts();
    boolean deleteProduct(String id, String sellerHandle);
    ProductResponseDto updateProductStatus(String id, String status);
}
