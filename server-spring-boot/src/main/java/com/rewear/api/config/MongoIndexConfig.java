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

            // Seed template items into MongoDB if repository is empty
            if (productRepository.count() == 0) {
                Category bottoms = categoryRepository.save(new Category("Bottoms", "bottoms"));
                Category ethnic = categoryRepository.save(new Category("Ethnic", "ethnic"));
                Category footwear = categoryRepository.save(new Category("Footwear", "footwear"));
                Category accessories = categoryRepository.save(new Category("Accessories", "accessories"));
                Category tops = categoryRepository.save(new Category("Tops", "tops"));

                Product p1 = new Product();
                p1.setTitle("Levi's 501 Jeans");
                p1.setDescription("Classic straight fit original jeans. Gently used in mint condition.");
                p1.setPrice(BigDecimal.valueOf(899));
                p1.setCondition("Gently Used");
                p1.setTransactionType("SELL");
                p1.setCategory(bottoms);
                p1.setSeller(guestUser);
                p1.setLatitude(19.1363);
                p1.setLongitude(72.8277);
                p1.setGeom(SpatialUtil.createPoint(19.1363, 72.8277));
                p1.setImages(List.of(new ProductImage("https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&h=600&fit=crop&auto=format", "p1", 0)));
                productRepository.save(p1);

                Product p2 = new Product();
                p2.setTitle("Vintage Floral Kurta");
                p2.setDescription("Authentic handcrafted cotton floral kurta. Great for summer.");
                p2.setPrice(BigDecimal.valueOf(450));
                p2.setCondition("Well Worn");
                p2.setTransactionType("EXCHANGE");
                p2.setCategory(ethnic);
                p2.setSeller(guestUser);
                p2.setLatitude(19.0596);
                p2.setLongitude(72.8295);
                p2.setGeom(SpatialUtil.createPoint(19.0596, 72.8295));
                p2.setImages(List.of(new ProductImage("https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800&h=600&fit=crop&auto=format", "p2", 0)));
                productRepository.save(p2);

                Product p3 = new Product();
                p3.setTitle("Nike Air Max 90");
                p3.setDescription("Iconic sneakers in white & red. Lightly worn, very clean.");
                p3.setPrice(BigDecimal.valueOf(1800));
                p3.setCondition("Gently Used");
                p3.setTransactionType("SELL");
                p3.setCategory(footwear);
                p3.setSeller(guestUser);
                p3.setLatitude(19.1075);
                p3.setLongitude(72.8263);
                p3.setGeom(SpatialUtil.createPoint(19.1075, 72.8263));
                p3.setImages(List.of(new ProductImage("https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=600&fit=crop&auto=format", "p3", 0)));
                productRepository.save(p3);

                Product p4 = new Product();
                p4.setTitle("Handwoven Tote Bag");
                p4.setDescription("Eco-friendly reusable tote bag. Free donation to community.");
                p4.setPrice(BigDecimal.ZERO);
                p4.setCondition("Gently Used");
                p4.setTransactionType("DONATE");
                p4.setCategory(accessories);
                p4.setSeller(guestUser);
                p4.setLatitude(19.1176);
                p4.setLongitude(72.9060);
                p4.setGeom(SpatialUtil.createPoint(19.1176, 72.9060));
                p4.setImages(List.of(new ProductImage("https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&h=600&fit=crop&auto=format", "p4", 0)));
                productRepository.save(p4);

                Product p5 = new Product();
                p5.setTitle("Oversized Linen Blazer");
                p5.setDescription("Beige relaxed fit blazer, 100% organic linen. Brand new with tags.");
                p5.setPrice(BigDecimal.valueOf(1200));
                p5.setCondition("Brand New");
                p5.setTransactionType("SELL");
                p5.setCategory(tops);
                p5.setSeller(guestUser);
                p5.setLatitude(19.0700);
                p5.setLongitude(72.8338);
                p5.setGeom(SpatialUtil.createPoint(19.0700, 72.8338));
                p5.setImages(List.of(new ProductImage("https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&h=600&fit=crop&auto=format", "p5", 0)));
                productRepository.save(p5);

                Product p6 = new Product();
                p6.setTitle("Wool Blend Overcoat");
                p6.setDescription("Premium warm tailored overcoat. Brand new, tags intact.");
                p6.setPrice(BigDecimal.valueOf(2200));
                p6.setCondition("Brand New");
                p6.setTransactionType("SELL");
                p6.setCategory(tops);
                p6.setSeller(guestUser);
                p6.setLatitude(19.0176);
                p6.setLongitude(72.8170);
                p6.setGeom(SpatialUtil.createPoint(19.0176, 72.8170));
                p6.setImages(List.of(new ProductImage("https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&h=600&fit=crop&auto=format", "p6", 0)));
                productRepository.save(p6);

                System.out.println("Seeded 6 default template products into MongoDB!");
            }
        };
    }
}
