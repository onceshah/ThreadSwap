package com.rewear.api.controller;

import com.rewear.api.dto.request.LoginRequest;
import com.rewear.api.dto.request.RefreshRequest;
import com.rewear.api.dto.request.RegisterRequest;
import com.rewear.api.dto.response.JwtResponse;
import com.rewear.api.security.JwtTokenProvider;
import com.rewear.api.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtTokenProvider tokenProvider;

    public AuthController(AuthService authService, JwtTokenProvider tokenProvider) {
        this.authService = authService;
        this.tokenProvider = tokenProvider;
    }

    @PostMapping("/register")
    public ResponseEntity<JwtResponse> registerUser(@Valid @RequestBody RegisterRequest registerRequest) {
        JwtResponse response = authService.register(registerRequest);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<JwtResponse> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
        JwtResponse response = authService.login(loginRequest);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<JwtResponse> refreshSession(@Valid @RequestBody RefreshRequest refreshRequest) {
        JwtResponse response = authService.refresh(refreshRequest);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<String> logoutUser(@Valid @RequestBody RefreshRequest refreshRequest) {
        String token = refreshRequest.getRefreshToken();
        if (tokenProvider.validateToken(token)) {
            String jti = tokenProvider.getJtiFromToken(token);
            authService.logout(jti);
            return ResponseEntity.ok("Logged out successfully");
        }
        return ResponseEntity.badRequest().body("Invalid refresh token context");
    }
}
