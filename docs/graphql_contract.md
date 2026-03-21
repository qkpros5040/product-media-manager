# Product Image Manager - GraphQL Contract

## Query: pimSelectedCategories

Request:

```graphql
query PIMCategories {
  pimSelectedCategories {
    id
    name
  }
}
```

Response shape:
- `id: Int`
- `name: String`

## Query: pimProducts

Request:

```graphql
query PIMProducts($categoryId: Int!, $search: String) {
  pimProducts(categoryId: $categoryId, search: $search) {
    id
    name
    hasImages
  }
}
```

Response shape:
- `id: Int`
- `name: String`
- `hasImages: Boolean`

## Query: pimProductImages

Request:

```graphql
query PIMProductImages($productId: Int!) {
  pimProductImages(productId: $productId) {
    featuredId
    images {
      id
      url
      fileName
      isFeatured
    }
  }
}
```

Response shape:
- `featuredId: Int`
- `images: [PIMImage]`

## Mutation: pimDetachProductImage

Request:

```graphql
mutation PIMDetach($productId: Int!, $attachmentId: Int!) {
  pimDetachProductImage(input: { productId: $productId, attachmentId: $attachmentId }) {
    success
    message
  }
}
```

## Mutation: pimSetFeaturedImage

Request:

```graphql
mutation PIMSetFeatured($productId: Int!, $attachmentId: Int!) {
  pimSetFeaturedImage(input: { productId: $productId, attachmentId: $attachmentId }) {
    success
    message
  }
}
```

## Mutation: pimUploadProductImages

Request (GraphQL multipart upload):

```graphql
mutation PIMUpload($productId: Int!, $files: [Upload]) {
  pimUploadProductImages(input: { productId: $productId, files: $files }) {
    success
    message
    results {
      success
      attachmentId
      url
      message
    }
  }
}
```

Response shape:
- `success: Boolean`
- `message: String`
- `results: [PIMUploadResult]`

Multipart transport format:
- `operations` JSON with query and variables where files are `null`
- `map` JSON mapping file indexes to `variables.files.<index>`
- file parts with matching indexes

## Error Contract

- GraphQL resolver/mutation errors return standard GraphQL errors array.
- User-facing messages are localized and safe for display.
- Authorization failures return `Unauthorized request.`

## Authorization Rules

- All operations require `manage_woocommerce` capability.
- GraphQL multipart uploads require WPGraphQL Upload scalar support.
- If Upload scalar is unavailable, uploader falls back to secure transport endpoint with nonce + capability validation.
