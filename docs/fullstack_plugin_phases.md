# Product Image Manager - Fullstack Implementation Phases

This phase plan is derived from:
- Product Image Manager Plugin Specification
- Product Image Manager - Architecture and Development Plan
- Product Image Manager Plugin - Technical Architecture

## Phase 0: Foundation and Project Bootstrap

### Goal
Set up a clean plugin baseline using the WordPress Plugin Boilerplate (WPPB) style architecture.

### Scope
- Create plugin root structure.
- Register loader, i18n, admin, public modules.
- Add assets pipeline for `admin` and `public` CSS/JS.
- Define constants, versioning, and activation/deactivation hooks.

### Deliverables
- Plugin boots without errors in WordPress.
- Core files and folders exist (`includes`, `admin`, `public`, `ajax`, `services`).
- Coding standards and lint rules documented.

### Exit Criteria
- Plugin activates/deactivates cleanly.
- Admin and public assets are loaded conditionally.

## Phase 1: Admin Settings and Access Control

### Goal
Allow administrators to configure categories and define who can use the plugin.

### Scope
- Add admin menu and settings page.
- Load WooCommerce product categories in a multi-select control.
- Save selected categories to `wp_options`.
- Add capability checks for `administrator` and `shop_manager`.

### Deliverables
- Settings UI with category selection and save action.
- Persisted plugin settings with validation and sanitization.
- Role-based access checks.

### Exit Criteria
- Admin can save selected categories.
- Unauthorized roles cannot access plugin settings.

## Phase 2: Frontend Shell and Navigation (Categories -> Products -> Detail)

### Goal
Build the folder-like user interface and navigation flow.

### Scope
- Implement shortcode to mount plugin UI.
- Build category folder list from configured categories.
- Build product folder list for selected category via AJAX.
- Build product detail panel for image management.
- Add breadcrumb navigation.
- Add product search.

### Deliverables
- Working navigation levels:
  - Level 1: Categories
  - Level 2: Products
  - Level 3: Product Detail
- AJAX endpoints for category/product loading.
- Responsive layout.

### Exit Criteria
- Manager can navigate from category to product detail without page reload.
- Search filters product list correctly.

## Phase 3: Upload Pipeline (Client + Server)

### Goal
Enable secure, multi-file drag-and-drop upload with progress feedback.

### Scope
- Integrate Dropzone.js in product detail view.
- Implement upload AJAX endpoint.
- Add nonce and capability validation in controller.
- Validate file type and size.
- Return structured JSON responses with per-file status.

### Deliverables
- Drag-and-drop uploader with progress UI.
- Upload endpoint connected to media service.
- Error messaging for invalid files and permission failures.

### Exit Criteria
- Multiple supported files upload in one session.
- UI updates progress and final result without refresh.

## Phase 4: Media Service and SKU-Based Naming

### Goal
Process files server-side and attach them to WooCommerce products using naming rules.

### Scope
- Create media handler service (`services/class-media-handler.php`).
- Fetch product SKU from meta.
- Rename files with sequence format: `SKU-1.jpg`, `SKU-2.jpg`, etc.
- Upload through WordPress media APIs.
- Attach to product gallery and optionally set featured image.

### Deliverables
- Deterministic naming logic.
- Product attachment logic for featured and gallery images.
- Safe fallback behavior when SKU is missing.

### Exit Criteria
- Uploaded images are renamed and attached correctly.
- Attachments visible in WooCommerce product media fields.

## Phase 5: Image Management Actions

### Goal
Allow managers to view and manage existing product images.

### Scope
- Fetch featured and gallery images.
- Render thumbnails in product detail view.
- Detach image from product via AJAX (do not delete attachment file).
- Set selected image as featured.

### Deliverables
- Image grid with action controls.
- AJAX endpoints for detach and set-featured.
- Consistent success and error feedback.

### Exit Criteria
- Manager can detach and set featured image from UI.
- Product media state remains consistent after actions.

## Phase 6: UX and Visual System

### Goal
Polish usability and speed for day-to-day manager workflows.

### Scope
- Folder state indicators:
  - Green folder: has images
  - Red folder: no images
- Add loading states and empty states.
- Improve mobile and tablet responsiveness.
- Improve accessibility (focus states, keyboard navigation, labels).

### Deliverables
- Clear visual status and navigation affordances.
- Better perceived performance and usability.

### Exit Criteria
- UI is usable on desktop and mobile.
- Key interactions are accessible via keyboard.

## Phase 7: Security Hardening

### Goal
Ensure all endpoints and data paths are protected.

### Scope
- Enforce nonce checks in all AJAX actions.
- Enforce capability checks per endpoint.
- Sanitize all request inputs.
- Escape output in templates.
- Add centralized error handling for security violations.

### Deliverables
- Security checklist implemented across admin/public/AJAX.
- Unified error response format.

### Exit Criteria
- No unauthenticated or unauthorized image actions possible.
- Invalid input paths are rejected safely.

## Phase 8: Performance and Scalability

### Goal
Keep the interface responsive with large catalogs.

### Scope
- Add pagination for product lists.
- Add lazy loading/incremental loading.
- Optimize `WP_Query` usage and selected fields.
- Minimize duplicate AJAX calls and payload size.
- Add client-side caching for navigation state.

### Deliverables
- Fast category/product browsing at scale.
- Reduced server load and faster perceived response.

### Exit Criteria
- Large category product lists remain usable.
- Query and payload performance meet target benchmarks.

## Phase 9: Testing, QA, and Release

### Goal
Validate behavior, prevent regressions, and prepare release.

### Scope
- Functional tests:
  - category/product navigation
  - uploads
  - image detach/set-featured
- Role tests for `administrator` and `shop_manager`.
- Edge-case tests (missing SKU, unsupported files, oversized files).
- Manual cross-browser and responsive verification.
- Release checklist and versioned changelog.

### Deliverables
- Test report and known-issues log.
- Release candidate package.

### Exit Criteria
- Critical and high-severity issues resolved.
- Plugin release is approved.

## Suggested Milestone Grouping

- Milestone A (MVP): Phases 0-4
- Milestone B (Operational): Phases 5-7
- Milestone C (Scale + Release): Phases 8-9

## Recommended Definition of Done (Per Phase)

- Code complete and reviewed.
- Security checks included.
- Manual test cases passed for phase scope.
- Documentation updated for new behavior and endpoints.
