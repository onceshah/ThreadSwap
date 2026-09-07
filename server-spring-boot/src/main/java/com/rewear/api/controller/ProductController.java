package com.rewear.api.controller;

import com.rewear.api.dto.request.ProductRequestDto;
import com.rewear.api.dto.response.ProductResponseDto;
import com.rewear.api.entity.Role;
import com.rewear.api.entity.User;
import com.rewear.api.repository.RoleRepository;
import com.rewear.api.repository.UserRepository;
import com.rewear.api.security.CustomUserDetails;
import com.rewear.api.service.ProductService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;
import com.rewear.api.repository.ProductRepository;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/products")
public class ProductController {

    private final ProductService productService;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public ProductController(
            ProductService productService,
            ProductRepository productRepository,
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder) {
        this.productService = productService;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping
    public ResponseEntity<ProductResponseDto> createProduct(@Valid @RequestBody ProductRequestDto request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UUID sellerId = null;

        if (auth != null && auth.getPrincipal() instanceof CustomUserDetails) {
            sellerId = ((CustomUserDetails) auth.getPrincipal()).getId();
        } else if (request.getSellerEmail() != null && !request.getSellerEmail().isBlank()) {
            final String targetEmail = request.getSellerEmail().trim().toLowerCase();
            final String targetName = request.getSellerName() != null ? request.getSellerName().trim() : "Seller";
            User sellerUser = userRepository.findByEmail(targetEmail)
                    .orElseGet(() -> {
                        User u = new User();
                        u.setEmail(targetEmail);
                        u.setPasswordHash(passwordEncoder.encode("12345678"));
                        String[] parts = targetName.split(" ", 2);
                        u.setFirstName(parts[0]);
                        u.setLastName(parts.length > 1 ? parts[1] : "");
                        Role r = roleRepository.findByName("ROLE_USER")
                                .orElseGet(() -> roleRepository.save(new Role("ROLE_USER", "Standard user role")));
                        u.setRole(r);
                        return userRepository.save(u);
                    });
            sellerId = sellerUser.getId();
        } else {
            // Guest upload fallback: attach to a permanent guest account in MongoDB
            User guestUser = userRepository.findByEmail("guest@rewear.com")
                    .orElseGet(() -> {
                        User u = new User();
                        u.setEmail("guest@rewear.com");
                        u.setPasswordHash(passwordEncoder.encode("12345678"));
                        u.setFirstName("Priya");
                        u.setLastName("Sharma");
                        Role r = roleRepository.findByName("ROLE_USER")
                                .orElseGet(() -> roleRepository.save(new Role("ROLE_USER", "Standard user role")));
                        u.setRole(r);
                        return userRepository.save(u);
                    });
            sellerId = guestUser.getId();
        }

        ProductResponseDto response = productService.createProduct(request, sellerId);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<ProductResponseDto>> getProducts(
            @RequestParam(required = false) Double latitude,
            @RequestParam(required = false) Double longitude,
            @RequestParam(required = false) Double radius,
            @RequestParam(required = false) String city) {

        List<ProductResponseDto> list = productService.getAllProducts();

        // If specific city is requested (e.g. "Mumbai", "Dehradun")
        if (city != null && !city.isBlank() && !city.equalsIgnoreCase("all")) {
            final String cLower = city.trim().toLowerCase();
            list = list.stream().filter(p -> {
                Double pLat = p.getLatitude();
                Double pLng = p.getLongitude();
                if (pLat == null || pLng == null) return false;

                if (cLower.contains("mumbai")) {
                    return calculateDistanceKm(19.0760, 72.8777, pLat, pLng) <= 65.0;
                } else if (cLower.contains("dehradun")) {
                    return calculateDistanceKm(30.3165, 78.0322, pLat, pLng) <= 65.0;
                } else if (cLower.contains("delhi")) {
                    return calculateDistanceKm(28.6139, 77.2090, pLat, pLng) <= 65.0;
                } else if (cLower.contains("bangalore") || cLower.contains("bengaluru")) {
                    return calculateDistanceKm(12.9716, 77.5946, pLat, pLng) <= 65.0;
                }
                return true;
            }).collect(Collectors.toList());
        } else if (latitude != null && longitude != null && radius != null && radius > 0) {
            // Proximity filter based on provided coordinates and radius (in km)
            list = list.stream().filter(p -> {
                if (p.getLatitude() == null || p.getLongitude() == null) return false;
                double dist = calculateDistanceKm(latitude, longitude, p.getLatitude(), p.getLongitude());
                return dist <= radius;
            }).collect(Collectors.toList());
        }

        return ResponseEntity.ok(list);
    }

    @GetMapping("/stats")
    public ResponseEntity<java.util.Map<String, Object>> getProductStats() {
        long count = productRepository.count();
        long users = userRepository.count();

        java.util.Set<String> cities = new java.util.HashSet<>();
        for (com.rewear.api.entity.Product p : productRepository.findAll()) {
            if (p.getLatitude() != null && p.getLongitude() != null) {
                if (Math.abs(p.getLatitude() - 30.4) < 1.0) cities.add("Dehradun");
                else if (Math.abs(p.getLatitude() - 19.1) < 1.0) cities.add("Mumbai");
                else cities.add("Other");
            }
        }
        for (com.rewear.api.entity.User u : userRepository.findAll()) {
            if (u.getCity() != null && !u.getCity().isBlank()) {
                cities.add(u.getCity().trim());
            }
        }

        java.util.Map<String, Object> map = new java.util.HashMap<>();
        map.put("itemsSaved", count);
        map.put("activeUsers", users);
        map.put("citiesCovered", Math.max(cities.size(), 1));
        return ResponseEntity.ok(map);
    }

    private double calculateDistanceKm(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Earth radius in km
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteProduct(
            @PathVariable String id,
            @RequestParam(required = false) String sellerHandle) {
        boolean ok = productService.deleteProduct(id, sellerHandle);
        if (!ok) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Only the seller who published this item can delist it.");
        }
        return ResponseEntity.ok("Product deleted / delisted successfully");
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ProductResponseDto> updateProductStatus(
            @PathVariable String id,
            @RequestParam String status) {
        ProductResponseDto dto = productService.updateProductStatus(id, status);
        if (dto != null) {
            return ResponseEntity.ok(dto);
        }
        return ResponseEntity.notFound().build();
    }
}
