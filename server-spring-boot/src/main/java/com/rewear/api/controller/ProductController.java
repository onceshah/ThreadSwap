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

@RestController
@RequestMapping("/products")
public class ProductController {

    private final ProductService productService;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public ProductController(
            ProductService productService,
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder) {
        this.productService = productService;
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
            @RequestParam(defaultValue = "50.0") Double radius) {

        List<ProductResponseDto> list = productService.getAllProducts();
        return ResponseEntity.ok(list);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteProduct(@PathVariable String id) {
        productService.deleteProduct(id);
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
