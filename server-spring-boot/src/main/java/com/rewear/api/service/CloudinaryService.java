package com.rewear.api.service;

import com.rewear.api.dto.request.SignatureRequest;
import com.rewear.api.dto.response.SignatureResponse;

public interface CloudinaryService {
    SignatureResponse getUploadSignature(SignatureRequest request);
}
