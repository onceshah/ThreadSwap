package com.rewear.api.controller;

import com.rewear.api.entity.Product;
import com.rewear.api.entity.User;
import com.rewear.api.repository.ProductRepository;
import com.rewear.api.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequestMapping("/stats")
public class StatsController {

    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public StatsController(ProductRepository productRepository, UserRepository userRepository) {
        this.productRepository = productRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getMarketplaceStats() {
        long productCount = productRepository.count();
        long userCount = userRepository.count();

        // Dynamically compute distinct cities from products and users
        Set<String> distinctCities = new HashSet<>();
        List<Product> products = productRepository.findAll();
        for (Product p : products) {
            if (p.getLatitude() != null && p.getLongitude() != null) {
                if (Math.abs(p.getLatitude() - 30.4) < 1.0) {
                    distinctCities.add("Dehradun");
                } else if (Math.abs(p.getLatitude() - 19.1) < 1.0) {
                    distinctCities.add("Mumbai");
                } else if (Math.abs(p.getLatitude() - 28.6) < 1.0) {
                    distinctCities.add("Delhi");
                } else if (Math.abs(p.getLatitude() - 12.9) < 1.0) {
                    distinctCities.add("Bangalore");
                } else {
                    distinctCities.add(String.format(Locale.ROOT, "City (%.1f, %.1f)", p.getLatitude(), p.getLongitude()));
                }
            }
        }

        List<User> users = userRepository.findAll();
        for (User u : users) {
            if (u.getCity() != null && !u.getCity().isBlank()) {
                distinctCities.add(u.getCity().trim());
            }
        }

        // Always at least 1 city if any listings exist, otherwise count distinct
        int citiesCount = Math.max(distinctCities.size(), 1);

        Map<String, Object> stats = new HashMap<>();
        stats.put("itemsSaved", productCount);
        stats.put("activeUsers", userCount);
        stats.put("citiesCovered", citiesCount);
        stats.put("cities", new ArrayList<>(distinctCities));

        return ResponseEntity.ok(stats);
    }
}
