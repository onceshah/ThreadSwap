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

    private String normalizeHandle(String str) {
        if (str == null || str.isBlank()) return "";
        String s = str.trim().toLowerCase();
        if (s.contains("@")) {
            return s; // Keep full email intact
        }
        return s.split(" ")[0].replaceAll("^@", "");
    }

    private boolean isParticipantMatch(String p1, String p2, String userEmail, String userName) {
        String uEmail = (userEmail != null) ? userEmail.trim().toLowerCase() : "";
        String uName = (userName != null) ? getCleanHandle(userName) : "";

        boolean isEmailThread = p1.contains("@") || p2.contains("@");

        if (isEmailThread) {
            // Strict email match for email-keyed threads
            if (!uEmail.isEmpty()) {
                return p1.equalsIgnoreCase(uEmail) || p2.equalsIgnoreCase(uEmail);
            }
            return false;
        }

        // Legacy name-based thread fallback
        String p1Clean = getCleanHandle(p1);
        String p2Clean = getCleanHandle(p2);

        boolean emailHandleMatch = !uEmail.isEmpty() && (
            p1Clean.equals(getCleanHandle(uEmail)) || p2Clean.equals(getCleanHandle(uEmail))
        );
        boolean nameMatch = !uName.isEmpty() && (
            p1Clean.equals(uName) || p2Clean.equals(uName) ||
            p1Clean.contains(uName) || uName.contains(p1Clean) ||
            p2Clean.equals(uName) || uName.contains(p2Clean)
        );

        return emailHandleMatch || nameMatch;
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

        String u1Norm = normalizeHandle(user1);
        String u2Norm = normalizeHandle(user2);

        if ((u1Norm.isEmpty() || u2Norm.isEmpty()) && threadKey != null && threadKey.contains("<->")) {
            String raw = threadKey.contains("::") ? threadKey.split("::")[0] : threadKey;
            String[] parts = raw.split("<->", 2);
            if (parts.length >= 2) {
                if (u1Norm.isEmpty()) u1Norm = normalizeHandle(parts[0]);
                if (u2Norm.isEmpty()) u2Norm = normalizeHandle(parts[1]);
            }
        }

        if (u1Norm.isEmpty() || u2Norm.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        final String targetU1 = u1Norm;
        final String targetU2 = u2Norm;

        List<ChatMessage> all = chatMessageRepository.findAll();
        List<ChatMessage> consolidated = all.stream()
                .filter(m -> {
                    if (m.getThreadKey() == null) return false;
                    String tk = m.getThreadKey().toLowerCase().trim();
                    String raw = tk.contains("::") ? tk.split("::")[0] : tk;
                    String[] parts = raw.split("<->", 2);
                    if (parts.length < 2) return false;

                    String p1 = normalizeHandle(parts[0]);
                    String p2 = normalizeHandle(parts[1]);

                    boolean direct = p1.equalsIgnoreCase(targetU1) && p2.equalsIgnoreCase(targetU2);
                    boolean reverse = p1.equalsIgnoreCase(targetU2) && p2.equalsIgnoreCase(targetU1);

                    if (direct || reverse) return true;

                    // If neither is email, allow legacy clean handle matching
                    if (!targetU1.contains("@") && !targetU2.contains("@") && !p1.contains("@") && !p2.contains("@")) {
                        String p1Clean = getCleanHandle(p1);
                        String p2Clean = getCleanHandle(p2);
                        String u1Clean = getCleanHandle(targetU1);
                        String u2Clean = getCleanHandle(targetU2);
                        boolean legDirect = (p1Clean.equals(u1Clean) || p1Clean.contains(u1Clean) || u1Clean.contains(p1Clean)) &&
                                            (p2Clean.equals(u2Clean) || p2Clean.contains(u2Clean) || u2Clean.contains(p2Clean));
                        boolean legReverse = (p1Clean.equals(u2Clean) || p1Clean.contains(u2Clean) || u2Clean.contains(p1Clean)) &&
                                             (p2Clean.equals(u1Clean) || p2Clean.contains(u1Clean) || u1Clean.contains(p2Clean));
                        return legDirect || legReverse;
                    }

                    return false;
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

        if ((userEmail == null || userEmail.isBlank()) && (userName == null || userName.isBlank())) {
            return ResponseEntity.ok(List.of());
        }

        List<ChatMessage> all = chatMessageRepository.findAll();
        List<ChatMessage> userMsgs = all.stream()
                .filter(m -> {
                    if (m.getThreadKey() == null) return false;
                    String tk = m.getThreadKey().toLowerCase().trim();
                    String raw = tk.contains("::") ? tk.split("::")[0] : tk;
                    String[] parts = raw.split("<->", 2);
                    if (parts.length < 2) return false;

                    String p1 = normalizeHandle(parts[0]);
                    String p2 = normalizeHandle(parts[1]);

                    return isParticipantMatch(p1, p2, userEmail, userName);
                })
                .sorted(Comparator.comparing(ChatMessage::getSentAt).reversed())
                .collect(Collectors.toList());
        return ResponseEntity.ok(userMsgs);
    }

    /**
     * POST /api/v1/chat-messages
     * Body: { threadKey, senderName, senderEmail, text }
     */
    @PostMapping
    public ResponseEntity<ChatMessage> sendMessage(@RequestBody Map<String, String> body) {
        String threadKey = body.get("threadKey");
        String senderName = body.get("senderName");
        String senderEmail = body.get("senderEmail");
        String text = body.get("text");

        if (threadKey == null || senderName == null || text == null || text.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        ChatMessage msg = new ChatMessage(threadKey, senderName, senderEmail, text);
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

        String u1Norm = normalizeHandle(user1);
        String u2Norm = normalizeHandle(user2);

        if ((u1Norm.isEmpty() || u2Norm.isEmpty()) && threadKey != null && threadKey.contains("<->")) {
            String raw = threadKey.contains("::") ? threadKey.split("::")[0] : threadKey;
            String[] parts = raw.split("<->", 2);
            if (parts.length >= 2) {
                if (u1Norm.isEmpty()) u1Norm = normalizeHandle(parts[0]);
                if (u2Norm.isEmpty()) u2Norm = normalizeHandle(parts[1]);
            }
        }

        if (u1Norm.isEmpty() || u2Norm.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("deleted", 0, "error", "Invalid users"));
        }

        final String targetU1 = u1Norm;
        final String targetU2 = u2Norm;

        List<ChatMessage> all = chatMessageRepository.findAll();
        List<ChatMessage> toDelete = all.stream()
                .filter(m -> {
                    if (m.getThreadKey() == null) return false;
                    String tk = m.getThreadKey().toLowerCase().trim();
                    String raw = tk.contains("::") ? tk.split("::")[0] : tk;
                    String[] parts = raw.split("<->", 2);
                    if (parts.length < 2) return false;

                    String p1 = normalizeHandle(parts[0]);
                    String p2 = normalizeHandle(parts[1]);

                    boolean direct = p1.equalsIgnoreCase(targetU1) && p2.equalsIgnoreCase(targetU2);
                    boolean reverse = p1.equalsIgnoreCase(targetU2) && p2.equalsIgnoreCase(targetU1);
                    if (direct || reverse) return true;

                    // If neither target nor message participants contain @, allow legacy handle matching
                    if (!targetU1.contains("@") && !targetU2.contains("@") && !p1.contains("@") && !p2.contains("@")) {
                        String p1Clean = getCleanHandle(p1);
                        String p2Clean = getCleanHandle(p2);
                        String u1Clean = getCleanHandle(targetU1);
                        String u2Clean = getCleanHandle(targetU2);
                        boolean legDirect = (p1Clean.equals(u1Clean) || p1Clean.contains(u1Clean) || u1Clean.contains(p1Clean)) &&
                                            (p2Clean.equals(u2Clean) || p2Clean.contains(u2Clean) || u2Clean.contains(p2Clean));
                        boolean legReverse = (p1Clean.equals(u2Clean) || p1Clean.contains(u2Clean) || u2Clean.contains(p1Clean)) &&
                                             (p2Clean.equals(u1Clean) || p2Clean.contains(u1Clean) || u1Clean.contains(p2Clean));
                        return legDirect || legReverse;
                    }
                    return false;
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
