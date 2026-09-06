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

    private String getCleanHandle(String str) {
        if (str == null || str.isBlank()) return "";
        String s = str.trim().toLowerCase();
        if (s.contains("@")) {
            s = s.split("@")[0];
        }
        s = s.split(" ")[0].replaceAll("^@", "");
        return s;
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

        String u1Clean = getCleanHandle(user1);
        String u2Clean = getCleanHandle(user2);

        if ((u1Clean.isEmpty() || u2Clean.isEmpty()) && threadKey != null && threadKey.contains("<->")) {
            String raw = threadKey.contains("::") ? threadKey.split("::")[0] : threadKey;
            String[] parts = raw.split("<->", 2);
            if (parts.length >= 2) {
                if (u1Clean.isEmpty()) u1Clean = getCleanHandle(parts[0]);
                if (u2Clean.isEmpty()) u2Clean = getCleanHandle(parts[1]);
            }
        }

        if (u1Clean.isEmpty() || u2Clean.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        final String targetU1 = u1Clean;
        final String targetU2 = u2Clean;

        List<ChatMessage> all = chatMessageRepository.findAll();
        List<ChatMessage> consolidated = all.stream()
                .filter(m -> {
                    if (m.getThreadKey() == null) return false;
                    String tk = m.getThreadKey().toLowerCase();
                    String raw = tk.contains("::") ? tk.split("::")[0] : tk;
                    String[] parts = raw.split("<->", 2);
                    if (parts.length < 2) return false;

                    String p1 = getCleanHandle(parts[0]);
                    String p2 = getCleanHandle(parts[1]);

                    // Universal participant check: p1 & p2 match targetU1 & targetU2 or vice-versa
                    boolean direct = (p1.equals(targetU1) || p1.contains(targetU1) || targetU1.contains(p1)) &&
                                     (p2.equals(targetU2) || p2.contains(targetU2) || targetU2.contains(p2));
                    boolean reverse = (p1.equals(targetU2) || p1.contains(targetU2) || targetU2.contains(p1)) &&
                                      (p2.equals(targetU1) || p2.contains(targetU1) || targetU1.contains(p2));

                    return direct || reverse;
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

        String h1 = getCleanHandle(userEmail);
        String h2 = getCleanHandle(userName);

        if (h1.isEmpty() && h2.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<ChatMessage> all = chatMessageRepository.findAll();
        List<ChatMessage> userMsgs = all.stream()
                .filter(m -> {
                    if (m.getThreadKey() == null) return false;
                    String tk = m.getThreadKey().toLowerCase();
                    String raw = tk.contains("::") ? tk.split("::")[0] : tk;
                    String[] parts = raw.split("<->", 2);
                    if (parts.length < 2) return false;

                    String p1 = getCleanHandle(parts[0]);
                    String p2 = getCleanHandle(parts[1]);

                    boolean match1 = !h1.isEmpty() && (p1.equals(h1) || p2.equals(h1) || p1.contains(h1) || h1.contains(p1) || p2.contains(h1) || h1.contains(p2));
                    boolean match2 = !h2.isEmpty() && (p1.equals(h2) || p2.equals(h2) || p1.contains(h2) || h2.contains(p1) || p2.contains(h2) || h2.contains(p2));

                    return match1 || match2;
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
     * DELETE /api/v1/chat-messages/thread?user1=UserA&user2=UserB
     * Deletes all messages between the two users.
     */
    @RequestMapping(value = "/thread", method = {RequestMethod.DELETE, RequestMethod.POST, RequestMethod.GET})
    public ResponseEntity<Map<String, Object>> deleteThread(
            @RequestParam(required = false) String threadKey,
            @RequestParam(required = false) String user1,
            @RequestParam(required = false) String user2) {

        String u1Clean = getCleanHandle(user1);
        String u2Clean = getCleanHandle(user2);

        if ((u1Clean.isEmpty() || u2Clean.isEmpty()) && threadKey != null && threadKey.contains("<->")) {
            String raw = threadKey.contains("::") ? threadKey.split("::")[0] : threadKey;
            String[] parts = raw.split("<->", 2);
            if (parts.length >= 2) {
                if (u1Clean.isEmpty()) u1Clean = getCleanHandle(parts[0]);
                if (u2Clean.isEmpty()) u2Clean = getCleanHandle(parts[1]);
            }
        }

        if (u1Clean.isEmpty() || u2Clean.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("deleted", 0, "error", "Invalid users"));
        }

        final String targetU1 = u1Clean;
        final String targetU2 = u2Clean;

        List<ChatMessage> all = chatMessageRepository.findAll();
        List<ChatMessage> toDelete = all.stream()
                .filter(m -> {
                    if (m.getThreadKey() == null) return false;
                    String tk = m.getThreadKey().toLowerCase();
                    String raw = tk.contains("::") ? tk.split("::")[0] : tk;
                    String[] parts = raw.split("<->", 2);
                    if (parts.length < 2) return false;

                    String p1 = getCleanHandle(parts[0]);
                    String p2 = getCleanHandle(parts[1]);

                    boolean direct = (p1.equals(targetU1) || p1.contains(targetU1) || targetU1.contains(p1)) &&
                                     (p2.equals(targetU2) || p2.contains(targetU2) || targetU2.contains(p2));
                    boolean reverse = (p1.equals(targetU2) || p1.contains(targetU2) || targetU2.contains(p1)) &&
                                      (p2.equals(targetU1) || p2.contains(targetU1) || targetU1.contains(p2));

                    return direct || reverse;
                })
                .collect(Collectors.toList());

        chatMessageRepository.deleteAll(toDelete);
        return ResponseEntity.ok(Map.of("deleted", toDelete.size(), "message", "Thread deleted successfully"));
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
