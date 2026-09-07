package com.rewear.api.config;

import com.rewear.api.entity.Category;
import com.rewear.api.entity.Product;
import com.rewear.api.entity.ProductImage;
import com.rewear.api.entity.Role;
import com.rewear.api.entity.User;
import com.rewear.api.repository.CategoryRepository;
import com.rewear.api.repository.ProductRepository;
import com.rewear.api.repository.RoleRepository;
import com.rewear.api.repository.UserRepository;
import com.rewear.api.util.SpatialUtil;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeospatialIndex;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.util.List;

@Configuration
public class MongoIndexConfig {

    @Bean
    public CommandLineRunner initDatabase(
            MongoTemplate mongoTemplate,
            ProductRepository productRepository,
            UserRepository userRepository,
            CategoryRepository categoryRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder) {
        return args -> {
            try {
                mongoTemplate.indexOps("products")
                    .ensureIndex(new GeospatialIndex("geom").typed(GeoSpatialIndexType.GEO_2DSPHERE));
                System.out.println("2dsphere index ensured on products collection");
            } catch (Exception e) {
                System.out.println("Could not ensure index: " + e.getMessage());
            }

            // Seed default guest user
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

            // Template seeding removed - marketplace only shows real user listings
        };
    }
}
