package com.rewear.api.service.impl;

import com.cloudinary.Cloudinary;
import com.rewear.api.dto.request.SignatureRequest;
import com.rewear.api.dto.response.SignatureResponse;
import com.rewear.api.service.CloudinaryService;
import org.springframework.stereotype.Service;
import java.util.HashMap;
import java.util.Map;

@Service
public class CloudinaryServiceImpl implements CloudinaryService {

    private final Cloudinary cloudinary;

    public CloudinaryServiceImpl(Cloudinary cloudinary) {
        this.cloudinary = cloudinary;
    }

    @Override
    public SignatureResponse getUploadSignature(SignatureRequest request) {
        long timestamp = System.currentTimeMillis() / 1000L;

        Map<String, Object> params = new HashMap<>();
        params.put("folder", request.getFolder());
        params.put("timestamp", timestamp);

        // Sign parameters using Cloudinary private secret
        String signature = cloudinary.apiSignRequest(params, cloudinary.config.apiSecret);

        return new SignatureResponse(
                signature,
                timestamp,
                cloudinary.config.apiKey,
                cloudinary.config.cloudName
        );
    }
}
