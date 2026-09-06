package com.rewear.api.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DocumentReference;
import java.time.Instant;

@Document(collection = "wishlists")
public class Wishlist {

    @Id
    private WishlistId id;

    @DocumentReference
    private User user;

    @DocumentReference
    private Product product;

    private Instant createdAt = Instant.now();

    public Wishlist() {}

    public Wishlist(User user, Product product) {
        this.id = new WishlistId(user.getId(), product.getId());
        this.user = user;
        this.product = product;
    }

    public WishlistId getId() { return id; }
    public void setId(WishlistId id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
