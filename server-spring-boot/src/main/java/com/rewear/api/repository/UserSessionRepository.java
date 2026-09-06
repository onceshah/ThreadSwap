package com.rewear.api.repository;

import com.rewear.api.entity.UserSession;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserSessionRepository extends MongoRepository<UserSession, UUID> {
    Optional<UserSession> findByRefreshToken(String refreshToken);
    Optional<UserSession> findByJti(String jti);
    void deleteByExpiresAtBefore(Instant now);
}
