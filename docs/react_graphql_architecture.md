# Product Image Manager - React and GraphQL Architecture

## Purpose
Define the target architecture after migrating from jQuery + AJAX to React + GraphQL.

## Core Architecture

React UI (wp-element)
-> GraphQL Client (fetch /graphql)
-> WPGraphQL Schema (plugin fields and mutations)
-> PHP Service Layer
-> WordPress Media API + WooCommerce Product Meta

## Module Responsibilities

- React App:
  - Render categories, products, and image manager views
  - Manage UI state, loading states, and optimistic updates
  - Execute GraphQL queries and mutations
- GraphQL Schema Service:
  - Register plugin-specific object types
  - Register RootQuery fields for category/product/image reads
  - Register mutations for image actions
- Media Handler Service:
  - SKU naming rules
  - Upload processing and validation
  - Featured/gallery attach/detach logic

## GraphQL Operations

Queries:
- `pimSelectedCategories`
- `pimProducts(categoryId, search)`
- `pimProductImages(productId)`

Mutations:
- `pimDetachProductImage(input)`
- `pimSetFeaturedImage(input)`

Upload:
- Primary path uses GraphQL multipart upload mutation (`pimUploadProductImages`).
- Fallback path uses secure upload transport endpoint when Upload scalar is unavailable.

## Security Model

- Capability checks (`manage_woocommerce`) in every resolver and mutation.
- Nonce/session checks for upload transport.
- Sanitization and validation in PHP service layer.
- Escaped output in PHP templates.

## Performance Model

- Limit query field selection and list sizes.
- Add pagination arguments for products/images.
- Add client-side caching per category/product context.
- Prevent duplicate concurrent requests from UI.

## Compatibility Requirements

- WPGraphQL plugin must be active for GraphQL operations.
- WPGraphQL Upload scalar support is required for true multipart GraphQL file upload.
- If WPGraphQL is unavailable, UI must display clear install/activation guidance.
