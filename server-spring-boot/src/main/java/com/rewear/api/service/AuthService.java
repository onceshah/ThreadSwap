package com.rewear.api.service;

import com.rewear.api.dto.request.LoginRequest;
import com.rewear.api.dto.request.RefreshRequest;
import com.rewear.api.dto.request.RegisterRequest;
import com.rewear.api.dto.response.JwtResponse;

public interface AuthService {
    JwtResponse register(RegisterRequest request);
    JwtResponse login(LoginRequest request);
    JwtResponse refresh(RefreshRequest request);
    void logout(String jti);
}
