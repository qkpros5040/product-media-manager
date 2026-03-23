<?php

if (!defined('ABSPATH')) {
    exit;
}

class Product_Image_Manager_GraphQL
{
    private $media_handler;

    public function __construct()
    {
        $this->media_handler = new Product_Image_Manager_Media_Handler();
    }

    public function register_schema()
    {
        if (!function_exists('register_graphql_field') || !function_exists('register_graphql_object_type')) {
            return;
        }

        $this->register_types();
        $this->register_queries();
        $this->register_mutations();
    }

    private function register_types()
    {
        register_graphql_object_type('PIMCategory', array(
            'fields' => array(
                'id' => array('type' => 'Int'),
                'name' => array('type' => 'String'),
            ),
        ));

        register_graphql_object_type('PIMProduct', array(
            'fields' => array(
                'id' => array('type' => 'Int'),
                'name' => array('type' => 'String'),
                'hasImages' => array('type' => 'Boolean'),
                'permalink' => array('type' => 'String'),
            ),
        ));

        register_graphql_object_type('PIMImage', array(
            'fields' => array(
                'id' => array('type' => 'Int'),
                'url' => array('type' => 'String'),
                'fileName' => array('type' => 'String'),
                'isFeatured' => array('type' => 'Boolean'),
            ),
        ));

        register_graphql_object_type('PIMProductImagesPayload', array(
            'fields' => array(
                'featuredId' => array('type' => 'Int'),
                'images' => array('type' => array('list_of' => 'PIMImage')),
            ),
        ));

        register_graphql_object_type('PIMMutationResult', array(
            'fields' => array(
                'success' => array('type' => 'Boolean'),
                'message' => array('type' => 'String'),
            ),
        ));

        register_graphql_object_type('PIMUploadResult', array(
            'fields' => array(
                'success' => array('type' => 'Boolean'),
                'attachmentId' => array('type' => 'Int'),
                'url' => array('type' => 'String'),
                'message' => array('type' => 'String'),
            ),
        ));

        register_graphql_object_type('PIMUploadPayload', array(
            'fields' => array(
                'success' => array('type' => 'Boolean'),
                'message' => array('type' => 'String'),
                'results' => array('type' => array('list_of' => 'PIMUploadResult')),
            ),
        ));
    }

    private function register_queries()
    {
        register_graphql_field('RootQuery', 'pimSelectedCategories', array(
            'type' => array('list_of' => 'PIMCategory'),
            'resolve' => function () {
                $this->authorize_graphql();

                $selected_ids = array_map('absint', get_option('pim_selected_categories', array()));

                $terms = get_terms(array(
                    'taxonomy' => 'product_cat',
                    'hide_empty' => false,
                    'include' => $selected_ids,
                ));

                $data = array();
                foreach ($terms as $term) {
                    $data[] = array(
                        'id' => (int) $term->term_id,
                        'name' => html_entity_decode((string) $term->name, ENT_QUOTES, 'UTF-8'),
                    );
                }

                return $data;
            },
        ));

        register_graphql_field('RootQuery', 'pimProducts', array(
            'type' => array('list_of' => 'PIMProduct'),
            'args' => array(
                'categoryId' => array('type' => 'Int'),
                'search' => array('type' => 'String'),
                'limit' => array('type' => 'Int'),
                'offset' => array('type' => 'Int'),
            ),
            'resolve' => function ($root, $args) {
                $this->authorize_graphql();

                $category_id = isset($args['categoryId']) ? absint($args['categoryId']) : 0;
                $search = isset($args['search']) ? sanitize_text_field($args['search']) : '';
                $limit = isset($args['limit']) ? absint($args['limit']) : 25;
                $offset = isset($args['offset']) ? absint($args['offset']) : 0;

                if ($limit < 1) {
                    $limit = 25;
                }

                if ($limit > 100) {
                    $limit = 100;
                }

                if (!$category_id) {
                    throw new GraphQL\Error\UserError(__('Category is required.', 'product-image-manager'));
                }

                $query = new WP_Query(array(
                    'post_type' => 'product',
                    'post_status' => 'publish',
                    'posts_per_page' => $limit,
                    'offset' => $offset,
                    's' => $search,
                    'tax_query' => array(
                        array(
                            'taxonomy' => 'product_cat',
                            'field' => 'term_id',
                            'terms' => array($category_id),
                        ),
                    ),
                    'fields' => 'ids',
                ));

                $products = array();
                foreach ($query->posts as $product_id) {
                    $gallery = get_post_meta($product_id, '_product_image_gallery', true);
                    $has_images = has_post_thumbnail($product_id) || !empty($gallery);

                    $products[] = array(
                        'id' => (int) $product_id,
                        'name' => html_entity_decode((string) get_the_title($product_id), ENT_QUOTES, 'UTF-8'),
                        'hasImages' => (bool) $has_images,
                        'permalink' => get_permalink($product_id),
                    );
                }

                return $products;
            },
        ));

        register_graphql_field('RootQuery', 'pimProductImages', array(
            'type' => 'PIMProductImagesPayload',
            'args' => array(
                'productId' => array('type' => 'Int'),
            ),
            'resolve' => function ($root, $args) {
                $this->authorize_graphql();

                $product_id = isset($args['productId']) ? absint($args['productId']) : 0;
                if (!$product_id) {
                    throw new GraphQL\Error\UserError(__('Product is required.', 'product-image-manager'));
                }

                return $this->media_handler->get_product_images($product_id);
            },
        ));
    }

    private function register_mutations()
    {
        if (!function_exists('register_graphql_mutation')) {
            return;
        }

        register_graphql_mutation('pimDetachProductImage', array(
            'inputFields' => array(
                'productId' => array('type' => 'Int'),
                'attachmentId' => array('type' => 'Int'),
            ),
            'outputFields' => array(
                'success' => array('type' => 'Boolean'),
                'message' => array('type' => 'String'),
            ),
            'mutateAndGetPayload' => function ($input) {
                $this->authorize_graphql();

                $product_id = isset($input['productId']) ? absint($input['productId']) : 0;
                $attachment_id = isset($input['attachmentId']) ? absint($input['attachmentId']) : 0;

                if (!$product_id || !$attachment_id) {
                    throw new GraphQL\Error\UserError(__('Product and attachment are required.', 'product-image-manager'));
                }

                return $this->media_handler->detach_image($product_id, $attachment_id);
            },
        ));

        register_graphql_mutation('pimSetFeaturedImage', array(
            'inputFields' => array(
                'productId' => array('type' => 'Int'),
                'attachmentId' => array('type' => 'Int'),
            ),
            'outputFields' => array(
                'success' => array('type' => 'Boolean'),
                'message' => array('type' => 'String'),
            ),
            'mutateAndGetPayload' => function ($input) {
                $this->authorize_graphql();

                $product_id = isset($input['productId']) ? absint($input['productId']) : 0;
                $attachment_id = isset($input['attachmentId']) ? absint($input['attachmentId']) : 0;

                if (!$product_id || !$attachment_id) {
                    throw new GraphQL\Error\UserError(__('Product and attachment are required.', 'product-image-manager'));
                }

                return $this->media_handler->set_featured_image($product_id, $attachment_id);
            },
        ));

        register_graphql_mutation('pimReorderGalleryImages', array(
            'inputFields' => array(
                'productId' => array('type' => 'Int'),
                'attachmentIds' => array('type' => array('list_of' => 'Int')),
            ),
            'outputFields' => array(
                'success' => array('type' => 'Boolean'),
                'message' => array('type' => 'String'),
            ),
            'mutateAndGetPayload' => function ($input) {
                $this->authorize_graphql();

                $product_id = isset($input['productId']) ? absint($input['productId']) : 0;
                if (!$product_id) {
                    throw new GraphQL\Error\UserError(__('Product is required.', 'product-image-manager'));
                }

                $attachment_ids = isset($input['attachmentIds']) && is_array($input['attachmentIds'])
                    ? array_map('absint', $input['attachmentIds'])
                    : array();

                return $this->media_handler->reorder_gallery_images($product_id, $attachment_ids);
            },
        ));

        if ($this->has_upload_scalar()) {
            register_graphql_mutation('pimUploadProductImages', array(
                'inputFields' => array(
                    'productId' => array('type' => 'Int'),
                    'files' => array('type' => array('list_of' => 'Upload')),
                ),
                'outputFields' => array(
                    'success' => array('type' => 'Boolean'),
                    'message' => array('type' => 'String'),
                    'results' => array('type' => array('list_of' => 'PIMUploadResult')),
                ),
                'mutateAndGetPayload' => function ($input) {
                    $this->authorize_graphql();

                    $product_id = isset($input['productId']) ? absint($input['productId']) : 0;
                    if (!$product_id) {
                        throw new GraphQL\Error\UserError(__('Product is required.', 'product-image-manager'));
                    }

                    $files = isset($input['files']) && is_array($input['files']) ? $input['files'] : array();
                    if (empty($files)) {
                        throw new GraphQL\Error\UserError(__('At least one file is required.', 'product-image-manager'));
                    }

                    $normalized = $this->normalize_upload_inputs($files);
                    if (empty($normalized)) {
                        throw new GraphQL\Error\UserError(__('Unable to parse uploaded files.', 'product-image-manager'));
                    }

                    $result = $this->media_handler->handle_upload_collection($product_id, $normalized);
                    if (!$result['success']) {
                        $result['message'] = __('One or more files failed to upload.', 'product-image-manager');
                    }

                    return $result;
                },
            ));
        }
    }

    private function has_upload_scalar()
    {
        if (!class_exists('WPGraphQL') || !method_exists('WPGraphQL', 'get_type_registry')) {
            return false;
        }

        $registry = WPGraphQL::get_type_registry();
        if (!is_object($registry) || !method_exists($registry, 'get_type')) {
            return false;
        }

        return (bool) $registry->get_type('Upload');
    }

    private function normalize_upload_inputs($files)
    {
        $normalized = array();

        foreach ($files as $file) {
            if (is_array($file) && isset($file['tmp_name'])) {
                $normalized[] = array(
                    'name' => isset($file['name']) ? (string) $file['name'] : 'upload.bin',
                    'type' => isset($file['type']) ? (string) $file['type'] : '',
                    'tmp_name' => (string) $file['tmp_name'],
                    'error' => isset($file['error']) ? (int) $file['error'] : 0,
                    'size' => isset($file['size']) ? (int) $file['size'] : 0,
                );
                continue;
            }

            if (is_object($file) && method_exists($file, 'getClientFilename') && method_exists($file, 'getStream')) {
                $stream = $file->getStream();
                $meta = is_object($stream) && method_exists($stream, 'getMetadata') ? $stream->getMetadata() : array();
                $tmp_name = isset($meta['uri']) ? (string) $meta['uri'] : '';

                if (empty($tmp_name)) {
                    continue;
                }

                $normalized[] = array(
                    'name' => (string) $file->getClientFilename(),
                    'type' => method_exists($file, 'getClientMediaType') ? (string) $file->getClientMediaType() : '',
                    'tmp_name' => $tmp_name,
                    'error' => method_exists($file, 'getError') ? (int) $file->getError() : 0,
                    'size' => method_exists($file, 'getSize') ? (int) $file->getSize() : 0,
                );
            }
        }

        return $normalized;
    }

    private function authorize_graphql()
    {
        if (!$this->can_access_manager()) {
            throw new GraphQL\Error\UserError(__('Unauthorized request.', 'product-image-manager'));
        }
    }

    private function can_access_manager()
        {
            // Standard WP capabilities
            if (
                current_user_can('manage_product_images') ||
                current_user_can('manage_options') ||
                current_user_can('manage_woocommerce')
            ) {
                return true;
            }

            // ACF field check for user permission
            if (function_exists('get_field')) {
                $user_id = get_current_user_id();
                if ($user_id) {
                    $access = get_field('access_in_dashboard', 'user_' . $user_id);
                    if (is_array($access)) {
                        // If field is a multi-select or checkbox
                        return in_array('productmanager', $access, true);
                    } elseif (is_string($access)) {
                        // If field is a single select or text
                        return $access === 'productmanager';
                    }
                }
            }
            return false;
        }
}
