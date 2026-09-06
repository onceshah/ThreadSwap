# ReWear — Location-Based Eco Thrift & Swap Web Application

ReWear is a community-driven location-based thrift marketplace web application where users can buy pre-loved clothes or swap items 1-to-1 within their neighborhood radius.

## Project Structure
* `client-web/` - React Single-Page Web Application built with Vite, Tailwind/Modern CSS glassmorphism UI, Lucide icons, and interactive modals.
* `server-spring-boot/` - Spring Boot backend microservice (Java 17, Spring Security JWT, REST API, WebSockets, PostgreSQL/PostGIS).
* `database_schema.sql` - Production-ready PostgreSQL 15+ normalized schema with spatial GIS indexes.

## Running the Web Application
```bash
cd client-web
npm install
npm run dev
```
The web app runs standalone with high-performance mock thrift data, and automatically connects to the Spring Boot REST API (`http://localhost:8080`) when running!
