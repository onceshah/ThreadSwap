package com.rewear.api.service.impl;

import com.rewear.api.dto.request.ImageDto;
import com.rewear.api.dto.request.ProductRequestDto;
import com.rewear.api.dto.response.ProductResponseDto;
import com.rewear.api.entity.Category;
import com.rewear.api.entity.Product;
import com.rewear.api.entity.ProductImage;
import com.rewear.api.entity.User;
import com.rewear.api.exception.BadRequestException;
import com.rewear.api.repository.CategoryRepository;
import com.rewear.api.repository.ProductRepository;
import com.rewear.api.repository.UserRepository;
import com.rewear.api.service.ProductService;
import com.rewear.api.util.SpatialUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;

    public ProductServiceImpl(
            ProductRepository productRepository,
            UserRepository userRepository,
            CategoryRepository categoryRepository) {
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.categoryRepository = categoryRepository;
    }

    @Override
    @Transactional
    public ProductResponseDto createProduct(ProductRequestDto request, UUID sellerId) {
        User seller = userRepository.findById(sellerId)
                .orElseThrow(() -> new BadRequestException("Seller not found"));

        Category category = null;
        if (request.getCategoryId() != null && !request.getCategoryId().isBlank()) {
            List<Category> matches = categoryRepository.findBySlug(request.getCategoryId().trim().toLowerCase());
            if (matches != null && !matches.isEmpty()) {
                category = matches.get(0);
            }
        }
        if (category == null) {
            String catName = (request.getCategoryId() != null && !request.getCategoryId().isBlank()) ? request.getCategoryId() : "Tops";
            category = categoryRepository.save(new Category(catName, catName.toLowerCase()));
        }

        Product product = new Product();
        product.setTitle(request.getTitle());
        product.setDescription(request.getDescription());
        product.setPrice(request.getPrice());
        product.setCondition(request.getCondition());
        product.setTransactionType(request.getTransactionType());
        product.setCategory(category);
        product.setSeller(seller);
        product.setCategoryName(category != null ? category.getName() : "Tops");
        product.setSellerName(request.getSellerName() != null ? request.getSellerName() : (seller != null ? (seller.getFirstName() + " " + seller.getLastName()).trim() : "Priya Sharma"));
        product.setSellerEmail(request.getSellerEmail() != null ? request.getSellerEmail() : (seller != null ? seller.getEmail() : "guest@rewear.com"));
        product.setLatitude(request.getLatitude());
        product.setLongitude(request.getLongitude());
        product.setLocationName(request.getLocationName() != null && !request.getLocationName().isBlank() ? request.getLocationName() : "Vikasnagar, Dehradun");
        
        // Convert lat/lon double to PostGIS JTS Point
        product.setGeom(SpatialUtil.createPoint(request.getLatitude(), request.getLongitude()));

        // Save base to generate ID first
        Product savedProduct = productRepository.save(product);

        // Map images relation with cascading active
        if (request.getImages() != null && !request.getImages().isEmpty()) {
            List<ProductImage> imageList = new ArrayList<>();
            for (ImageDto imgDto : request.getImages()) {
                imageList.add(new ProductImage(imgDto.getUrl(), imgDto.getPublicId(), imgDto.getSortOrder()));
            }
            savedProduct.setImages(imageList);
            savedProduct = productRepository.save(savedProduct); // Commit final list
        }

        return mapToResponseDto(savedProduct);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductResponseDto> getNearbyProducts(double latitude, double longitude, double radiusKm) {
        double radiusMeters = radiusKm * 1000.0;
        List<Product> products = productRepository.findNearbyProducts(latitude, longitude, radiusMeters);
        if (products.isEmpty()) {
            return getAllProducts();
        }
        return products.stream().map(this::mapToResponseDto).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductResponseDto> getAllProducts() {
        return productRepository.findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"))
                .stream().map(this::mapToResponseDto).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public boolean deleteProduct(String id, String sellerHandle) {
        Product p = null;
        try {
            UUID uuid = UUID.fromString(id);
            p = productRepository.findById(uuid).orElse(null);
        } catch (Exception e) {
            p = productRepository.findAll().stream()
                    .filter(x -> x.getId().toString().equalsIgnoreCase(id) || x.getTitle().equalsIgnoreCase(id))
                    .findFirst().orElse(null);
        }

        if (p == null) {
            return true; // Product already gone or deleted
        }

        if (sellerHandle != null && !sellerHandle.isBlank()) {
            String cleanReq = sellerHandle.trim().toLowerCase().replaceAll("^@", "");
            String sName = p.getSellerName() != null ? p.getSellerName().trim().toLowerCase().replaceAll("^@", "") : "";
            String sEmail = p.getSellerEmail() != null ? p.getSellerEmail().trim().toLowerCase() : "";

            boolean matchesName = !sName.isEmpty() && (cleanReq.contains(sName) || sName.contains(cleanReq));
            boolean matchesEmail = !sEmail.isEmpty() && (cleanReq.equalsIgnoreCase(sEmail) || sEmail.startsWith(cleanReq));
            boolean noSellerInfo = sName.isEmpty() && sEmail.isEmpty();

            if (!matchesName && !matchesEmail && !noSellerInfo) {
                return false; // Forbidden: Requester is not the seller of this item
            }
        }

        productRepository.delete(p);
        return true;
    }

    @Override
    @Transactional
    public ProductResponseDto updateProductStatus(String id, String status) {
        try {
            UUID uuid = UUID.fromString(id);
            Product p = productRepository.findById(uuid).orElse(null);
            if (p != null) {
                p.setStatus(status);
                return mapToResponseDto(productRepository.save(p));
            }
        } catch (Exception e) {
            Product p = productRepository.findAll().stream()
                    .filter(x -> x.getId().toString().equalsIgnoreCase(id) || x.getTitle().equalsIgnoreCase(id))
                    .findFirst().orElse(null);
            if (p != null) {
                p.setStatus(status);
                return mapToResponseDto(productRepository.save(p));
            }
        }
        return null;
    }

    private ProductResponseDto mapToResponseDto(Product product) {
        ProductResponseDto dto = new ProductResponseDto();
        dto.setId(product.getId());
        dto.setTitle(product.getTitle());
        dto.setDescription(product.getDescription());
        dto.setPrice(product.getPrice());
        dto.setCondition(product.getCondition());
        dto.setTransactionType(product.getTransactionType());
        dto.setStatus(product.getStatus());
        String catName = product.getCategoryName();
        if (catName == null) {
            try { catName = product.getCategory() != null ? product.getCategory().getName() : "Tops"; }
            catch (Exception ignored) { catName = "Tops"; }
        }
        dto.setCategoryName(catName);

        String sName = product.getSellerName();
        String sEmail = product.getSellerEmail();
        if (sName == null || sEmail == null) {
            try {
                if (product.getSeller() != null) {
                    dto.setSellerId(product.getSeller().getId());
                    if (sName == null) sName = (product.getSeller().getFirstName() + " " + product.getSeller().getLastName()).trim();
                    if (sEmail == null) sEmail = product.getSeller().getEmail();
                }
            } catch (Exception ignored) {}
        }
        dto.setSellerName(sName != null && !sName.isBlank() ? sName : "Priya Sharma");
        dto.setSellerEmail(sEmail != null && !sEmail.isBlank() ? sEmail : "guest@rewear.com");
        dto.setLatitude(product.getLatitude() != null ? product.getLatitude() : 19.1363);
        dto.setLongitude(product.getLongitude() != null ? product.getLongitude() : 72.8277);

        String locName = product.getLocationName();
        if (locName == null || locName.isBlank()) {
            if (product.getLatitude() != null && product.getLongitude() != null) {
                if (Math.abs(product.getLatitude() - 30.4035) < 0.25 && Math.abs(product.getLongitude() - 77.9340) < 0.25) {
                    locName = "Vikasnagar, Dehradun";
                } else if (Math.abs(product.getLatitude() - 30.3165) < 0.35 && Math.abs(product.getLongitude() - 78.0322) < 0.35) {
                    locName = "Dehradun, Uttarakhand";
                } else if (Math.abs(product.getLatitude() - 19.1) < 0.6 && Math.abs(product.getLongitude() - 72.8) < 0.6) {
                    locName = "Andheri West, Mumbai";
                } else {
                    locName = product.getLatitude().toString() + ", " + product.getLongitude().toString();
                }
            } else {
                locName = "Vikasnagar, Dehradun";
            }
        }
        dto.setLocationName(locName);

        dto.setCreatedAt(product.getCreatedAt() != null ? DateTimeFormatter.ISO_INSTANT.format(product.getCreatedAt()) : Instant.now().toString());

        List<ImageDto> imageDtos = product.getImages() != null ? product.getImages().stream().map(img -> 
            new ImageDto(img.getUrl(), img.getPublicId(), img.getSortOrder())
        ).collect(Collectors.toList()) : new ArrayList<>();
        dto.setImages(imageDtos);

        return dto;
    }
}
