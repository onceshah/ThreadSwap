package com.rewear.api.controller;

import com.rewear.api.dto.request.SignatureRequest;
import com.rewear.api.dto.response.SignatureResponse;
import com.rewear.api.service.CloudinaryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/media")
public class MediaController {

    private final CloudinaryService cloudinaryService;

    public MediaController(CloudinaryService cloudinaryService) {
        this.cloudinaryService = cloudinaryService;
    }

    @PostMapping("/upload-signature")
    public ResponseEntity<SignatureResponse> getUploadSignature(@RequestBody(required = false) SignatureRequest request) {
        if (request == null) {
            request = new SignatureRequest();
        }
        SignatureResponse response = cloudinaryService.getUploadSignature(request);
        return ResponseEntity.ok(response);
    }
}
