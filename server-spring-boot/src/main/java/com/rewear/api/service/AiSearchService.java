package com.rewear.api.service;

import com.rewear.api.dto.request.AiSearchRequestDto;
import com.rewear.api.dto.response.AiSearchResponseDto;

public interface AiSearchService {
    AiSearchResponseDto performSemanticSearch(AiSearchRequestDto request);
}
