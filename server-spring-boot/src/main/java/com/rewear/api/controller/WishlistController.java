package com.rewear.api.controller;

import com.rewear.api.dto.request.ImageDto;
import com.rewear.api.dto.response.ProductResponseDto;
import com.rewear.api.entity.Product;
import com.rewear.api.entity.User;
import com.rewear.api.entity.Wishlist;
import com.rewear.api.entity.WishlistId;
import com.rewear.api.exception.BadRequestException;
import com.rewear.api.repository.ProductRepository;
import com.rewear.api.repository.UserRepository;
import com.rewear.api.repository.WishlistRepository;
import com.rewear.api.security.CustomUserDetails;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/wishlist")
public class WishlistController {

    private final WishlistRepository wishlistRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;

    public WishlistController(WishlistRepository wishlistRepository, UserRepository userRepository, ProductRepository productRepository) {
        this.wishlistRepository = wishlistRepository;
        this.userRepository = userRepository;
        this.productRepository = productRepository;
    }

    @GetMapping
    public ResponseEntity<List<ProductResponseDto>> getWishlist() {
        CustomUserDetails userDetails = (CustomUserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();

        List<Wishlist> wishlists = wishlistRepository.findByUserId(userDetails.getId());
        List<ProductResponseDto> response = wishlists.stream()
                .map(w -> mapToResponseDto(w.getProduct()))
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/{productId}")
    public ResponseEntity<ProductResponseDto> addToWishlist(@PathVariable UUID productId) {
        CustomUserDetails userDetails = (CustomUserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new BadRequestException("Product not found"));

        User user = userRepository.findById(userDetails.getId())
                .orElseThrow(() -> new BadRequestException("User not found"));

        if (!wishlistRepository.existsByIdUserIdAndIdProductId(user.getId(), product.getId())) {
            Wishlist wishlist = new Wishlist(user, product);
            wishlistRepository.save(wishlist);
        }

        return ResponseEntity.ok(mapToResponseDto(product));
    }

    @DeleteMapping("/{productId}")
    public ResponseEntity<String> removeFromWishlist(@PathVariable UUID productId) {
        CustomUserDetails userDetails = (CustomUserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();

        WishlistId id = new WishlistId(userDetails.getId(), productId);
        if (wishlistRepository.existsById(id)) {
            wishlistRepository.deleteById(id);
        }

        return ResponseEntity.ok("Product removed from wishlist successfully");
    }

    private ProductResponseDto mapToResponseDto(Product product) {
        ProductResponseDto dto = new ProductResponseDto();
        dto.setId(product.getId());
        dto.setTitle(product.getTitle());
        dto.setDescription(product.getDescription());
        dto.setPrice(product.getPrice());
        dto.setCondition(product.getCondition());
        dto.setTransactionType(product.getTransactionType());
        dto.setStatus(product.getStatus());
        dto.setCategoryName(product.getCategory() != null ? product.getCategory().getName() : "Uncategorized");
        dto.setSellerId(product.getSeller().getId());
        dto.setSellerName(product.getSeller().getFirstName() + " " + product.getSeller().getLastName());
        dto.setLatitude(product.getLatitude());
        dto.setLongitude(product.getLongitude());
        if (product.getCreatedAt() != null) {
            dto.setCreatedAt(DateTimeFormatter.ISO_INSTANT.format(product.getCreatedAt()));
        }

        List<ImageDto> imageDtos = product.getImages().stream().map(img ->
            new ImageDto(img.getUrl(), img.getPublicId(), img.getSortOrder())
        ).collect(Collectors.toList());
        dto.setImages(imageDtos);

        return dto;
    }
}
