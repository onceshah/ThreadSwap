package com.rewear.api.controller;

import com.rewear.api.entity.ChatMessage;
import com.rewear.api.repository.ChatMessageRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Simple REST API for persisting and fetching chat messages.
 * Uses a flat "threadKey" model (UserA<->UserB::ProductTitle) so no
 * complex authentication or conversation setup is required.
 */
@RestController
@RequestMapping("/chat-messages")
public class SimpleChatController {

    private final ChatMessageRepository chatMessageRepository;

    public SimpleChatController(ChatMessageRepository chatMessageRepository) {
        this.chatMessageRepository = chatMessageRepository;
    }

    /**
     * GET /api/v1/chat-messages?threadKey=UserA<->UserB
     * Returns all messages for the user pair, consolidating older product-specific threads into one.
     */
    @GetMapping
    public ResponseEntity<List<ChatMessage>> getMessages(
            @RequestParam String threadKey,
            @RequestParam(required = false) String user1,
            @RequestParam(required = false) String user2) {

        String u1Clean = (user1 != null && !user1.isBlank()) ? user1.trim().toLowerCase().split("@")[0].split(" ")[0] : "";
        String u2Clean = (user2 != null && !user2.isBlank()) ? user2.trim().toLowerCase().split("@")[0].split(" ")[0] : "";

        if ((u1Clean.isEmpty() || u2Clean.isEmpty()) && threadKey != null && threadKey.contains("<->")) {
            String raw = threadKey.contains("::") ? threadKey.split("::")[0] : threadKey;
            String[] parts = raw.split("<->", 2);
            if (parts.length >= 2) {
                if (u1Clean.isEmpty()) u1Clean = parts[0].trim().toLowerCase().split("@")[0].split(" ")[0];
                if (u2Clean.isEmpty()) u2Clean = parts[1].trim().toLowerCase().split("@")[0].split(" ")[0];
            }
        }

        if (u1Clean.isEmpty() && u2Clean.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        final String finalU1 = u1Clean;
        final String finalU2 = u2Clean;

        List<ChatMessage> all = chatMessageRepository.findAll();
        List<ChatMessage> consolidated = all.stream()
                .filter(m -> {
                    if (m.getThreadKey() == null) return false;
                    String tk = m.getThreadKey().toLowerCase();
                    String sn = m.getSenderName() != null ? m.getSenderName().toLowerCase() : "";

                    if (!finalU1.isEmpty() && !finalU2.isEmpty()) {
                        boolean u1Match = tk.contains(finalU1) || sn.contains(finalU1);
                        boolean u2Match = tk.contains(finalU2) || sn.contains(finalU2);
                        return u1Match && u2Match;
                    } else if (!finalU1.isEmpty()) {
                        return tk.contains(finalU1) || sn.contains(finalU1);
                    }
                    return tk.equals(threadKey.toLowerCase());
                })
                .sorted(Comparator.comparing(ChatMessage::getSentAt))
                .collect(Collectors.toList());

        return ResponseEntity.ok(consolidated);
    }

    /**
     * GET /api/v1/chat-messages/my-threads?userName=Vansh&userEmail=vansh@gmail.com
     * Returns all messages for threads involving the given user by name or email.
     */
    @GetMapping("/my-threads")
    public ResponseEntity<List<ChatMessage>> getMyThreads(
            @RequestParam(required = false) String userName,
            @RequestParam(required = false) String userEmail) {

        String searchName = userName != null ? userName.trim().toLowerCase() : "";
        String searchEmail = userEmail != null ? userEmail.trim().toLowerCase() : "";

        String handle1 = searchEmail.contains("@") ? searchEmail.split("@")[0] : searchEmail;
        String handle2 = searchName.contains("@") ? searchName.split("@")[0] : (searchName.contains(" ") ? searchName.split(" ")[0] : searchName);

        if (handle1.isEmpty() && handle2.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<ChatMessage> all = chatMessageRepository.findAll();
        List<ChatMessage> userMsgs = all.stream()
                .filter(m -> {
                    if (m.getThreadKey() == null) return false;
                    String tk = m.getThreadKey().toLowerCase();
                    String sn = m.getSenderName() != null ? m.getSenderName().toLowerCase() : "";
                    return (!handle1.isEmpty() && (tk.contains(handle1) || sn.contains(handle1))) ||
                           (!handle2.isEmpty() && (tk.contains(handle2) || sn.contains(handle2)));
                })
                .sorted(Comparator.comparing(ChatMessage::getSentAt).reversed())
                .collect(Collectors.toList());
        return ResponseEntity.ok(userMsgs);
    }

    /**
     * POST /api/v1/chat-messages
     * Body: { threadKey, senderName, text }
     */
    @PostMapping
    public ResponseEntity<ChatMessage> sendMessage(@RequestBody Map<String, String> body) {
        String threadKey = body.get("threadKey");
        String senderName = body.get("senderName");
        String text = body.get("text");

        if (threadKey == null || senderName == null || text == null || text.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        ChatMessage msg = new ChatMessage(threadKey, senderName, text);
        ChatMessage saved = chatMessageRepository.save(msg);
        return ResponseEntity.ok(saved);
    }

    /**
     * DELETE /api/v1/chat-messages/clear-all
     * Deletes all chat messages from the MongoDB collection.
     */
    @RequestMapping(value = "/clear-all", method = {RequestMethod.DELETE, RequestMethod.POST, RequestMethod.GET})
    public ResponseEntity<Map<String, String>> clearAllMessages() {
        chatMessageRepository.deleteAll();
        return ResponseEntity.ok(Map.of("message", "All test chat messages cleared successfully"));
    }
}
