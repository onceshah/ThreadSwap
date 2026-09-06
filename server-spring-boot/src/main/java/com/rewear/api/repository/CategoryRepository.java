package com.rewear.api.repository;

import com.rewear.api.entity.Category;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface CategoryRepository extends MongoRepository<Category, UUID> {
    List<Category> findBySlug(String slug);
}
