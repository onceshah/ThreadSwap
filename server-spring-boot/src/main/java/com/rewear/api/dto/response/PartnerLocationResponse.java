package com.rewear.api.dto.response;

public class PartnerLocationResponse {
    private String partnerName;
    private Boolean shareLocation;
    private Double latitude;
    private Double longitude;
    private String address;

    public PartnerLocationResponse() {}

    public PartnerLocationResponse(String partnerName, Boolean shareLocation, Double latitude, Double longitude, String address) {
        this.partnerName = partnerName;
        this.shareLocation = shareLocation;
        this.latitude = latitude;
        this.longitude = longitude;
        this.address = address;
    }

    public String getPartnerName() { return partnerName; }
    public void setPartnerName(String partnerName) { this.partnerName = partnerName; }

    public Boolean getShareLocation() { return shareLocation; }
    public void setShareLocation(Boolean shareLocation) { this.shareLocation = shareLocation; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
}
