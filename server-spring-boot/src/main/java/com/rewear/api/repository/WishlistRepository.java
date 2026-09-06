package com.rewear.api.repository;

import com.rewear.api.entity.Wishlist;
import com.rewear.api.entity.WishlistId;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface WishlistRepository extends MongoRepository<Wishlist, WishlistId> {

    @Query("{ 'user': ?0 }")
    List<Wishlist> findByUserId(UUID userId);

    boolean existsByIdUserIdAndIdProductId(UUID userId, UUID productId);
}
