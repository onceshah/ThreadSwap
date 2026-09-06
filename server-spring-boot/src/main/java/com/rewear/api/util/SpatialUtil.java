package com.rewear.api.util;

import org.springframework.data.mongodb.core.geo.GeoJsonPoint;

public class SpatialUtil {

    public static GeoJsonPoint createPoint(double latitude, double longitude) {
        // GeoJsonPoint order is: longitude, latitude
        return new GeoJsonPoint(longitude, latitude);
    }
}
