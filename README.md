# Product Media Manager

WordPress plugin for fullstack WooCommerce product image management using React and GraphQL.

## Stack Direction

- Frontend UI: React (via WordPress wp-element)
- Data layer: WPGraphQL queries and mutations
- Media upload: secure upload transport with nonce/capability checks
- Backend domain logic: PHP service layer with WooCommerce integration

## Fullstack Rule

This repository follows a strict fullstack-complete rule:
- No feature is done until React UI, GraphQL contract, service logic, data integration, security checks, and QA are all implemented.
- Partial layer work (only frontend or only backend) stays in progress.
- Every phase must pass the gate defined in [docs/fullstack_plugin_phases.md](docs/fullstack_plugin_phases.md).

## Current Status

Development has started with a Phase 0 and Phase 1 baseline scaffold:
- Plugin bootstrap and loader architecture
- Admin settings page for category selection
- Public shortcode shell with React mount root
- GraphQL schema service for category/product/image queries and mutations
- Media handler service for upload, detach, and featured-image actions

## Project Structure

- [product-image-manager.php](product-image-manager.php)
- [docs/fullstack_plugin_phases.md](docs/fullstack_plugin_phases.md)
- [docs/react_graphql_architecture.md](docs/react_graphql_architecture.md)
- [docs/graphql_contract.md](docs/graphql_contract.md)
- [includes/class-product-image-manager.php](includes/class-product-image-manager.php)
- [includes/class-product-image-manager-loader.php](includes/class-product-image-manager-loader.php)
- [admin/class-product-image-manager-admin.php](admin/class-product-image-manager-admin.php)
- [admin/views/settings-page.php](admin/views/settings-page.php)
- [public/class-product-image-manager-public.php](public/class-product-image-manager-public.php)
- [public/views/app.php](public/views/app.php)
- [public/js/product-image-manager-public.js](public/js/product-image-manager-public.js)
- [public/css/product-image-manager-public.css](public/css/product-image-manager-public.css)
- [ajax/class-product-image-manager-ajax-controller.php](ajax/class-product-image-manager-ajax-controller.php)
- [services/class-product-image-manager-graphql.php](services/class-product-image-manager-graphql.php)
- [services/class-product-image-manager-media-handler.php](services/class-product-image-manager-media-handler.php)

## Next Build Order

1. Add GraphQL pagination and lazy loading for products and images.
2. Expand multipart GraphQL upload hardening and retry handling.
3. Harden GraphQL resolver validation and error contracts.
4. Add role-focused manual QA cases and release checklist.