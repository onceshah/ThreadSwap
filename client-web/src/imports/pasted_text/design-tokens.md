1. Visual Design Tokens (The Foundations)
A. Color Palette
To reflect the eco-friendly, vintage nature of thrift shopping, we use a curated Sustainable Earth palette:

Primary (Deep Sage): #2D5A27 (HSL: 117°, 39%, 25%) – Used for primary brand markers, success buttons, and header accents.
Secondary (Sand Drift): #E8D8C8 (HSL: 30°, 36%, 85%) – Soft background accents and chip containers.
Accent (Warm Clay): #C86B45 (HSL: 18°, 54%, 53%) – Highlight badges, sale actions, and transaction call-outs.
Neutral Dark (Slate Charcoal): #1C201A (HSL: 100°, 10%, 11%) – Default text colors and dark mode background blocks.
Neutral Light (Chalk Cream): #F9F7F4 (HSL: 40°, 20%, 98%) – Main light mode screen backgrounds.
B. Typography
Primary Font Family: Plus Jakarta Sans (Friendly, rounded geometric typeface for UI hierarchy).
Secondary Font Family: Inter (Highly legible neutral face for body text, lists, and forms).
Category	Size	Weight	Line Height	Case
Display 1	32sp	Bold (700)	40dp	Sentence
Headline	20sp	Semi-Bold (600)	26dp	Sentence
Subheading	16sp	Medium (500)	22dp	Sentence
Body Large	15sp	Regular (400)	20dp	Sentence
Body Small	12sp	Regular (400)	16dp	Sentence
Button	14sp	Bold (700)	18dp	UPPERCASE
C. Spacing System (8dp Grid)
All UI layout metrics follow an 8dp spacing grid:

4dp (Extra Small): Edge padding between labels or icon text pairs.
8dp (Small): Internal card padding, item margins in RecyclerView rows.
16dp (Medium): Default screen margins, container gutters.
24dp (Large): Vertically separating distinct layout sections.
48dp (Extra Large): Target sizing for touch areas (buttons, selectors).
2. Global Dark Mode & Accessibility Specs
A. Dark Mode Adaptive Tokens
Token	Light Mode Value	Dark Mode Value
App Background	Chalk Cream (#F9F7F4)	Midnight Forest (#121612)
Card / Dialog Background	White Solid (#FFFFFF)	Dark Slate (#1E241E)
Text Primary	Slate Charcoal (#1C201A)	Cream Frost (#F2F2F2)
Text Secondary	Muted Grey (#757575)	Ash Grey (#B0B0B0)
Borders / Dividers	Light Grey (#E0E0E0)	Charcoal Border (#2F362F)
B. Accessibility Guidelines (AAA Standard)
Touch Targets: Minimum interactive layout size is 48dp × 48dp.
Contrast Bounds: Contrast ratios for text meet or exceed 4.5:1 (light themes) and 7:1 (dark themes).
Screen Readers: Every ImageView container must implement structural descriptions:
xml

android:contentDescription="@string/desc_product_image"
Dynamic Font Scale: All size tags utilize sp instead of dp to resize gracefully.
3. Screen Specifications (Interactive Flows)
Flow A: Onboarding & Identity
Screen 1: Splash & Discovery Carousel
Purpose: Introduce users to the ReWear concept (sustainable thrift, location-based mapping, secure exchanges).
Components: Full-bleed background illustration (warm cream tones), smooth scrolling 3-slide pager, indicator dots, primary action footer.
Buttons:
GET STARTED (Sage Green button, heavy bottom-accent shadow).
LOG IN (Translucent text link).
Animations: Slide transition pager, scale indicators.
Accessibility: Navigation indicator dots include label readers.
Screen 2: Login & Security Vault
Purpose: Secure entry validation using JWT tokens.
Components: Dynamic logo animation, Material Input fields (Email, Password) with status indicators, forgot password utility.
Buttons:
SIGN IN (Full width, Sage Green, 12dp radius, elevation 2dp).
REGISTER ACCOUNT (Secondary Clay outline button).
Feedback/Error State: Invalid input triggers shaking effects and turns borders Warm Clay Red (#D32F2F).
Flow B: Search & Discovery (Home)
Screen 3: Proximity Feed & Tile map
Purpose: Main feed to browse products near the user's location.
Components:
Top banner search container with a slider icon.
Dual tab toggler: Feed View / Map View.
Feed View: Two-column grid of product listing cards.
Map View: OpenStreetMap (osmdroid) canvas displaying user coordinates and map pins.
Interactive Overlays: Radius adjustment floating card (adjusts slider range from 1km to 50km).
Animations: Shared Element Transition maps the tapped feed card to the product detail view.
Screen 4: Advanced Filter Sheet
Purpose: Filter products by transaction types, conditions, and distance.
Components: Bottom sheet drawer containing:
Distance slider (1km to 50km).
Condition selection chips: "Brand New", "Gently Used", "Well Worn".
Transaction chips: "Sell", "Exchange", "Free/Donate".
Buttons: APPLY FILTERS (Green block, full width), RESET (Outline button).
Animations: Bottom sheet slides up/down with interpolator curves.
Flow C: Product Listings & Media
Screen 5: Camera Capture & Guidelines
Purpose: Take photos of items using CameraX.
Components: Camera viewfinder frame with active aspect ratio helpers, bottom thumbnail roll previewing captured shots, floating shutter triggers.
Overlay: A transparent silhouette outline showing the item frame (e.g., "Place item here").
Buttons: Capture Shutter button, flash toggle, and upload button.
Screen 6: Listing Form Details
Purpose: Fill out listing details before publishing.
Components: Scrollable form containing:
Image slider (displays cropped thumbnails with drag-to-sort capabilities).
Price EditText input, Category selection spinner.
Location picker field (launches map view modal coordinates).
Buttons: PUBLISH ITEM (Warm Clay accent background, white text).
Flow D: Communication & Workspace
Screen 7: Inbox Conversation Lists
Purpose: View active chats.
Components: List of active chat logs showing:
Circular avatar letters.
Counterparty user's name.
Product thumbnail + title.
Unread indicators (solid green dots).
Screen 8: Chat Room View
Purpose: Live messaging between buyers and sellers.
Components:
Sticky header displaying product preview, price, and request states (Buy / Exchange).
Scrollable message container (left-aligned grey bubbles, right-aligned green bubbles).
Footer input bar with text entry and a send button.