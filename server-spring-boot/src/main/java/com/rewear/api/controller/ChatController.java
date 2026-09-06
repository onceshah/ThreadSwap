package com.rewear.api.controller;

import com.rewear.api.dto.response.PartnerLocationResponse;
import com.rewear.api.entity.Conversation;
import com.rewear.api.entity.Message;
import com.rewear.api.entity.SellerProfile;
import com.rewear.api.entity.User;
import com.rewear.api.repository.ConversationRepository;
import com.rewear.api.repository.MessageRepository;
import com.rewear.api.repository.SellerProfileRepository;
import com.rewear.api.security.CustomUserDetails;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/chats")
public class ChatController {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final SellerProfileRepository sellerProfileRepository;

    public ChatController(ConversationRepository conversationRepository, MessageRepository messageRepository, SellerProfileRepository sellerProfileRepository) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.sellerProfileRepository = sellerProfileRepository;
    }

    @GetMapping("/conversations")
    public ResponseEntity<List<Conversation>> getConversations() {
        CustomUserDetails userDetails = (CustomUserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();

        List<Conversation> list = conversationRepository.findAllByParticipantId(userDetails.getId());
        return ResponseEntity.ok(list);
    }

    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<Page<Message>> getConversationMessages(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        // Return latest messages first sorted descending by creation timestamp
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Message> messages = messageRepository.findByConversationIdOrderByCreatedAtDesc(id, pageable);
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/conversations/{id}/partner-location")
    public ResponseEntity<PartnerLocationResponse> getPartnerLocation(@PathVariable UUID id) {
        CustomUserDetails userDetails = (CustomUserDetails) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();

        Conversation conversation = conversationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));

        User partner = conversation.getBuyer().getId().equals(userDetails.getId())
                ? conversation.getSeller()
                : conversation.getBuyer();

        SellerProfile profile = sellerProfileRepository.findByUserId(partner.getId()).orElse(null);

        PartnerLocationResponse response = new PartnerLocationResponse();
        response.setPartnerName(partner.getFirstName() + " " + partner.getLastName());

        if (profile != null) {
            response.setShareLocation(profile.getShareLocation());
            if (Boolean.TRUE.equals(profile.getShareLocation())) {
                response.setLatitude(profile.getLatitude());
                response.setLongitude(profile.getLongitude());
                response.setAddress(profile.getAddress() != null ? profile.getAddress() : "Location shared");
            } else {
                response.setLatitude(null);
                response.setLongitude(null);
                response.setAddress(profile.getAddress() != null ? profile.getAddress() : "Address not provided");
            }
        } else {
            response.setShareLocation(false);
            response.setLatitude(null);
            response.setLongitude(null);
            response.setAddress("Address not shared");
        }

        return ResponseEntity.ok(response);
    }
}
