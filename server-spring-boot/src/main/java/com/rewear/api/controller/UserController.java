package com.rewear.api.controller;

import com.rewear.api.entity.User;
import com.rewear.api.repository.UserRepository;
import com.rewear.api.security.CustomUserDetails;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/users")
public class UserController {

    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@RequestParam(required = false) String email) {
        User user = resolveUser(email);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("id", user.getId());
        resp.put("email", user.getEmail());
        resp.put("firstName", user.getFirstName());
        resp.put("lastName", user.getLastName());
        resp.put("name", (user.getFirstName() + " " + (user.getLastName() != null ? user.getLastName() : "")).trim());
        resp.put("phone", user.getPhone() != null ? user.getPhone() : "");
        resp.put("city", user.getCity() != null ? user.getCity() : "");
        resp.put("location", user.getLocation() != null ? user.getLocation() : (user.getCity() != null ? user.getCity() + ", India" : ""));
        resp.put("bio", user.getBio() != null ? user.getBio() : "Passionate about circular fashion & zero textile waste.");
        resp.put("avatar", user.getAvatar());

        return ResponseEntity.ok(resp);
    }

    @PatchMapping("/profile")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, Object> updates, @RequestParam(required = false) String email) {
        User user = resolveUser(email != null ? email : (String) updates.get("email"));
        if (user == null) {
            return ResponseEntity.badRequest().body("User not found to update profile");
        }

        if (updates.containsKey("name")) {
            String name = (String) updates.get("name");
            if (name != null && !name.isBlank()) {
                String[] parts = name.trim().split(" ", 2);
                user.setFirstName(parts[0]);
                user.setLastName(parts.length > 1 ? parts[1] : "");
            }
        }
        if (updates.containsKey("firstName")) {
            user.setFirstName((String) updates.get("firstName"));
        }
        if (updates.containsKey("lastName")) {
            user.setLastName((String) updates.get("lastName"));
        }
        if (updates.containsKey("phone")) {
            user.setPhone((String) updates.get("phone"));
        }
        if (updates.containsKey("location")) {
            user.setLocation((String) updates.get("location"));
        }
        if (updates.containsKey("city")) {
            String c = (String) updates.get("city");
            if (c != null && !c.isBlank()) {
                user.setCity(c.trim());
            }
        }
        if (updates.containsKey("bio")) {
            user.setBio((String) updates.get("bio"));
        }
        if (updates.containsKey("avatar")) {
            user.setAvatar((String) updates.get("avatar"));
        }

        userRepository.save(user);

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("message", "Profile updated successfully");
        resp.put("avatar", user.getAvatar());
        resp.put("name", (user.getFirstName() + " " + (user.getLastName() != null ? user.getLastName() : "")).trim());
        resp.put("city", user.getCity());
        resp.put("location", user.getLocation());
        resp.put("phone", user.getPhone());
        resp.put("bio", user.getBio());

        return ResponseEntity.ok(resp);
    }

    private User resolveUser(String fallbackEmail) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomUserDetails) {
            return userRepository.findById(((CustomUserDetails) auth.getPrincipal()).getId()).orElse(null);
        }
        if (fallbackEmail != null && !fallbackEmail.isBlank()) {
            return userRepository.findByEmail(fallbackEmail.trim().toLowerCase()).orElse(null);
        }
        return null;
    }
}
