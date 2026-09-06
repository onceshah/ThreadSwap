package com.rewear.api.repository;

import com.rewear.api.entity.Product;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface ProductRepository extends MongoRepository<Product, UUID> {

    // MongoDB 2dsphere nearSphere query to find products within a radius in meters, sorted ascending by distance
    @Query("{ 'geom': { $nearSphere: { $geometry: { type: 'Point', coordinates: [ ?1, ?0 ] }, $maxDistance: ?2 } }, 'status': 'AVAILABLE' }")
    List<Product> findNearbyProducts(
            double latitude,
            double longitude,
            double radiusMeters
    );
}
