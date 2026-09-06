package com.rewear.api.controller;

import com.rewear.api.dto.request.AiSearchRequestDto;
import com.rewear.api.dto.response.AiSearchResponseDto;
import com.rewear.api.service.AiSearchService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/products/ai-search")
public class AiSearchController {

    private final AiSearchService aiSearchService;

    public AiSearchController(AiSearchService aiSearchService) {
        this.aiSearchService = aiSearchService;
    }

    @PostMapping
    public ResponseEntity<AiSearchResponseDto> performAiSemanticSearch(@RequestBody AiSearchRequestDto request) {
        AiSearchResponseDto response = aiSearchService.performSemanticSearch(request);
        return ResponseEntity.ok(response);
    }
}
