package com.rewear.api.repository;

import com.rewear.api.entity.ChatMessage;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {
    List<ChatMessage> findByThreadKeyOrderBySentAtAsc(String threadKey);
}
