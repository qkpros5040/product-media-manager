<?php

if (!defined('ABSPATH')) {
    exit;
}

class Product_Image_Manager_Ajax_Controller
{
    private $media_handler;

    public function __construct()
    {
        $this->media_handler = new Product_Image_Manager_Media_Handler();
    }

    private function authorize_request()
    {
        check_ajax_referer('pim_ajax_nonce', 'nonce');

        if (!$this->can_access_manager()) {
            wp_send_json_error(array('message' => __('Unauthorized request.', 'product-image-manager')), 403);
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

    public function load_products()
    {
        $this->authorize_request();

        $category_id = isset($_POST['categoryId']) ? absint($_POST['categoryId']) : 0;
        $search = isset($_POST['search']) ? sanitize_text_field(wp_unslash($_POST['search'])) : '';
        $limit = isset($_POST['limit']) ? absint($_POST['limit']) : 25;
        $offset = isset($_POST['offset']) ? absint($_POST['offset']) : 0;

        if ($limit < 1) {
            $limit = 25;
        }

        if ($limit > 100) {
            $limit = 100;
        }

        if (!$category_id) {
            wp_send_json_error(array('message' => __('Category is required.', 'product-image-manager')), 400);
        }

        $args = array(
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
        );

        $query = new WP_Query($args);
        $products = array();

        foreach ($query->posts as $product_id) {
            $gallery = get_post_meta($product_id, '_product_image_gallery', true);
            $has_images = has_post_thumbnail($product_id) || !empty($gallery);

            $products[] = array(
                'id' => $product_id,
                'name' => html_entity_decode((string) get_the_title($product_id), ENT_QUOTES, 'UTF-8'),
                'hasImages' => (bool) $has_images,
                'permalink' => get_permalink($product_id),
            );
        }

        wp_send_json_success(array('products' => $products));
    }

    public function load_product_images()
    {
        $this->authorize_request();

        $product_id = isset($_POST['productId']) ? absint($_POST['productId']) : 0;
        if (!$product_id) {
            wp_send_json_error(array('message' => __('Product is required.', 'product-image-manager')), 400);
        }

        $data = $this->media_handler->get_product_images($product_id);
        wp_send_json_success($data);
    }

    public function upload_product_images()
    {
        $this->authorize_request();

        $product_id = isset($_POST['productId']) ? absint($_POST['productId']) : 0;
        if (!$product_id) {
            wp_send_json_error(array('message' => __('Product is required.', 'product-image-manager')), 400);
        }

        if (empty($_FILES['files'])) {
            wp_send_json_error(array('message' => __('No files provided.', 'product-image-manager')), 400);
        }

        $result = $this->media_handler->handle_upload_batch($product_id, $_FILES['files']);

        if (!$result['success']) {
            wp_send_json_error($result, 400);
        }

        wp_send_json_success($result);
    }

    public function detach_product_image()
    {
        $this->authorize_request();

        $product_id = isset($_POST['productId']) ? absint($_POST['productId']) : 0;
        $attachment_id = isset($_POST['attachmentId']) ? absint($_POST['attachmentId']) : 0;

        if (!$product_id || !$attachment_id) {
            wp_send_json_error(array('message' => __('Product and attachment are required.', 'product-image-manager')), 400);
        }

        $result = $this->media_handler->detach_image($product_id, $attachment_id);

        if (!$result['success']) {
            wp_send_json_error($result, 400);
        }

        wp_send_json_success($result);
    }

    public function set_featured_image()
    {
        $this->authorize_request();

        $product_id = isset($_POST['productId']) ? absint($_POST['productId']) : 0;
        $attachment_id = isset($_POST['attachmentId']) ? absint($_POST['attachmentId']) : 0;

        if (!$product_id || !$attachment_id) {
            wp_send_json_error(array('message' => __('Product and attachment are required.', 'product-image-manager')), 400);
        }

        $result = $this->media_handler->set_featured_image($product_id, $attachment_id);

        if (!$result['success']) {
            wp_send_json_error($result, 400);
        }

        wp_send_json_success($result);
    }

    public function reorder_gallery_images()
    {
        $this->authorize_request();

        $product_id = isset($_POST['productId']) ? absint($_POST['productId']) : 0;
        if (!$product_id) {
            wp_send_json_error(array('message' => __('Product is required.', 'product-image-manager')), 400);
        }

        $attachment_ids = array();
        if (isset($_POST['attachmentIds'])) {
            $raw_ids = wp_unslash($_POST['attachmentIds']);

            if (is_array($raw_ids)) {
                $attachment_ids = array_map('absint', $raw_ids);
            } else {
                $decoded = json_decode((string) $raw_ids, true);
                if (is_array($decoded)) {
                    $attachment_ids = array_map('absint', $decoded);
                }
            }
        }

        $result = $this->media_handler->reorder_gallery_images($product_id, $attachment_ids);

        if (!$result['success']) {
            wp_send_json_error($result, 400);
        }

        wp_send_json_success($result);
    }
}
