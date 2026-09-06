package com.rewear.api.repository;

import com.rewear.api.entity.Conversation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConversationRepository extends MongoRepository<Conversation, UUID> {

    @Query(value = "{ '$or': [ { 'buyer': ?0 }, { 'seller': ?0 } ] }", sort = "{ 'updatedAt': -1 }")
    List<Conversation> findAllByParticipantId(UUID userId);

    @Query("{ 'product': ?0, 'buyer': ?1, 'seller': ?2 }")
    Optional<Conversation> findByProductIdAndBuyerIdAndSellerId(UUID productId, UUID buyerId, UUID sellerId);
}
