package com.rewear.api.service.impl;

import com.rewear.api.dto.request.LoginRequest;
import com.rewear.api.dto.request.RefreshRequest;
import com.rewear.api.dto.request.RegisterRequest;
import com.rewear.api.dto.response.JwtResponse;
import com.rewear.api.entity.Role;
import com.rewear.api.entity.User;
import com.rewear.api.entity.UserSession;
import com.rewear.api.exception.BadRequestException;
import com.rewear.api.exception.UnauthorizedException;
import com.rewear.api.repository.RoleRepository;
import com.rewear.api.repository.UserRepository;
import com.rewear.api.repository.UserSessionRepository;
import com.rewear.api.security.CustomUserDetails;
import com.rewear.api.security.JwtTokenProvider;
import com.rewear.api.service.AuthService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserSessionRepository userSessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;

    public AuthServiceImpl(
            UserRepository userRepository,
            RoleRepository roleRepository,
            UserSessionRepository userSessionRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userSessionRepository = userSessionRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.tokenProvider = tokenProvider;
    }

    @Override
    @Transactional
    public JwtResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email is already taken");
        }

        Role userRole = roleRepository.findByName("ROLE_USER")
                .orElseGet(() -> roleRepository.save(new Role("ROLE_USER", "Standard user role")));

        User user = new User();
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setRole(userRole);

        User savedUser = userRepository.save(user);

        return createSessionAndGenerateResponse(savedUser, userRole.getName());
    }

    @Override
    @Transactional
    public JwtResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        User user = userRepository.findById(userDetails.getId())
                .orElseThrow(() -> new BadRequestException("User record missing"));

        return createSessionAndGenerateResponse(user, userDetails.getAuthorities().iterator().next().getAuthority());
    }

    @Override
    @Transactional
    public JwtResponse refresh(RefreshRequest request) {
        String token = request.getRefreshToken();
        UserSession session = userSessionRepository.findByRefreshToken(token)
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));

        if (session.getRevoked()) {
            throw new UnauthorizedException("Refresh token is revoked");
        }

        if (session.getExpiresAt().isBefore(Instant.now())) {
            userSessionRepository.delete(session);
            throw new UnauthorizedException("Refresh token is expired");
        }

        // Token Rotation: Revoke old session and issue a new one
        session.setRevoked(true);
        userSessionRepository.save(session);

        User user = session.getUser();
        return createSessionAndGenerateResponse(user, user.getRole().getName());
    }

    @Override
    @Transactional
    public void logout(String jti) {
        userSessionRepository.findByJti(jti).ifPresent(session -> {
            session.setRevoked(true);
            userSessionRepository.save(session);
        });
    }

    private JwtResponse createSessionAndGenerateResponse(User user, String roleName) {
        String accessToken = tokenProvider.generateAccessToken(user.getEmail(), roleName);
        String jti = UUID.randomUUID().toString();
        String refreshToken = tokenProvider.generateRefreshToken(user.getEmail(), jti);

        UserSession session = new UserSession();
        session.setUser(user);
        session.setRefreshToken(refreshToken);
        session.setJti(jti);
        session.setExpiresAt(Instant.now().plus(30, ChronoUnit.DAYS)); // Expiry 30 days
        session.setClientIp("127.0.0.1"); // Set from standard header inputs if interceptor exists
        session.setUserAgent("Mobile Client");

        userSessionRepository.save(session);

        return new JwtResponse(accessToken, refreshToken, user.getId(), user.getEmail(), roleName);
    }
}
