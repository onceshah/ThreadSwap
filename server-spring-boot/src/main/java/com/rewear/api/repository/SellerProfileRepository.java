package com.rewear.api.repository;

import com.rewear.api.entity.SellerProfile;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SellerProfileRepository extends MongoRepository<SellerProfile, UUID> {
    Optional<SellerProfile> findByUserId(UUID userId);
}
