package com.rewear.api.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rewear.api.dto.ChatMessageDto;
import com.rewear.api.entity.Conversation;
import com.rewear.api.entity.Message;
import com.rewear.api.entity.User;
import com.rewear.api.repository.ConversationRepository;
import com.rewear.api.repository.MessageRepository;
import com.rewear.api.repository.ProductRepository;
import com.rewear.api.repository.UserRepository;
import com.rewear.api.security.JwtTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger logger = LoggerFactory.getLogger(ChatWebSocketHandler.class);
    private static final ConcurrentHashMap<UUID, WebSocketSession> sessions = new ConcurrentHashMap<>();

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final ProductRepository productRepository;
    private final ObjectMapper objectMapper;

    public ChatWebSocketHandler(
            JwtTokenProvider tokenProvider,
            UserRepository userRepository,
            ConversationRepository conversationRepository,
            MessageRepository messageRepository,
            ProductRepository productRepository,
            ObjectMapper objectMapper) {
        this.tokenProvider = tokenProvider;
        this.userRepository = userRepository;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.productRepository = productRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        URI uri = session.getUri();
        if (uri != null) {
            String query = uri.getQuery();
            if (query != null && query.startsWith("token=")) {
                String token = query.substring(6);
                if (token.startsWith("Bearer%20") || token.startsWith("Bearer ")) {
                    token = token.substring(9);
                }

                if (tokenProvider.validateToken(token)) {
                    String email = tokenProvider.getEmailFromToken(token);
                    User user = userRepository.findByEmail(email).orElse(null);
                    if (user != null) {
                        session.getAttributes().put("userId", user.getId());
                        sessions.put(user.getId(), session);
                        logger.info("WebSocket connection established with user: {}", user.getEmail());
                        return;
                    }
                }
            }
        }
        logger.warn("WebSocket connection rejected: Invalid handshake credentials");
        session.close(CloseStatus.BAD_DATA);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        UUID senderId = (UUID) session.getAttributes().get("userId");
        if (senderId == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        try {
            ChatMessageDto dto = objectMapper.readValue(message.getPayload(), ChatMessageDto.class);

            User sender = userRepository.findById(senderId)
                    .orElseThrow(() -> new IllegalArgumentException("Sender not found"));
            User recipient = userRepository.findById(UUID.fromString(dto.getRecipientId()))
                    .orElseThrow(() -> new IllegalArgumentException("Recipient not found"));

            Conversation conversation;
            if (dto.getConversationId() != null) {
                conversation = conversationRepository.findById(UUID.fromString(dto.getConversationId()))
                        .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
                
                // Security Check: Verify sender is a participant of the conversation
                if (!conversation.getBuyer().getId().equals(senderId) && !conversation.getSeller().getId().equals(senderId)) {
                    throw new SecurityException("Unauthorized: Sender is not a participant in this conversation");
                }
            } else {
                UUID prodId = UUID.fromString(dto.getProductId());
                conversation = conversationRepository.findByProductIdAndBuyerIdAndSellerId(prodId, sender.getId(), recipient.getId())
                        .orElseGet(() -> {
                            Conversation newConv = new Conversation();
                            newConv.setProduct(productRepository.findById(prodId).orElse(null));
                            newConv.setBuyer(sender);
                            newConv.setSeller(recipient);
                            return conversationRepository.save(newConv);
                        });
            }

            // Save Message in DB
            Message msg = new Message();
            msg.setConversation(conversation);
            msg.setSender(sender);
            msg.setRecipient(recipient);
            msg.setContent(dto.getContent());
            msg.setRead(false);
            msg.setCreatedAt(Instant.now());

            Message savedMsg = messageRepository.save(msg);

            // Update Conversation timestamp
            conversation.setUpdatedAt(Instant.now());
            conversationRepository.save(conversation);

            String jsonPayload = objectMapper.writeValueAsString(savedMsg);

            // Send confirmation receipt to sender
            session.sendMessage(new TextMessage(jsonPayload));

            // Forward message to recipient if active
            WebSocketSession recipientSession = sessions.get(recipient.getId());
            if (recipientSession != null && recipientSession.isOpen()) {
                recipientSession.sendMessage(new TextMessage(jsonPayload));
            } else {
                // FALLBACK: recipient is offline, trigger push notification
                logger.info("Recipient {} offline. FCM notification trigger queued.", recipient.getEmail());
            }

        } catch (Exception e) {
            logger.error("Error processing WebSocket text payload", e);
            session.sendMessage(new TextMessage("{\"error\":\"Failed to process payload: " + e.getMessage() + "\"}"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        UUID userId = (UUID) session.getAttributes().get("userId");
        if (userId != null) {
            sessions.remove(userId);
            logger.info("WebSocket connection closed for user ID: {}", userId);
        }
    }
}
