package com.rewear.api.repository;

import com.rewear.api.entity.Role;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoleRepository extends MongoRepository<Role, UUID> {
    Optional<Role> findByName(String name);
}
