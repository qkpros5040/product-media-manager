<?php

if (!defined('ABSPATH')) {
    exit;
}

class Product_Image_Manager_GraphQL_Handler
{
    private $graphql_service;

    public function __construct()
    {
        $this->graphql_service = new Product_Image_Manager_GraphQL();
    }

    /**
     * Initialize GraphQL request validation and handling
     */
    public function init()
    {
        add_filter('rest_request_before_callbacks', array($this, 'validate_graphql_request'), 10, 3);
        add_filter('graphql_request_data', array($this, 'preprocess_graphql_request'));
    }

    /**
     * Validate GraphQL requests before they reach resolvers
     *
     * @param mixed             $response  The response (or null to continue).
     * @param WP_REST_Server    $server    REST server instance.
     * @param WP_REST_Request   $request   The REST request.
     */
    public function validate_graphql_request($response, $server, $request)
    {
        // Only validate GraphQL endpoint requests
        if (strpos($request->get_route(), '/graphql') === false) {
            return $response;
        }

        // Validate request method
        if ('POST' !== $request->get_method()) {
            return new WP_Error(
                'graphql_invalid_method',
                __('GraphQL only accepts POST requests.', 'product-image-manager'),
                array('status' => 405)
            );
        }

        // Validate nonce for custom PIM operations
        $body = $request->get_json_params();

        if (empty($body['query'])) {
            return new WP_Error(
                'graphql_missing_query',
                __('GraphQL query is required.', 'product-image-manager'),
                array('status' => 400)
            );
        }

        // Check if this is a PIM operation (pim* mutations/queries)
        if ($this->is_pim_operation($body['query'])) {
            if (!$this->validate_nonce($request)) {
                return new WP_Error(
                    'graphql_invalid_nonce',
                    __('Nonce verification failed. Please refresh the page and try again.', 'product-image-manager'),
                    array('status' => 403)
                );
            }

            if (!$this->can_access_manager()) {
                return new WP_Error(
                    'graphql_unauthorized',
                    __('You do not have permission to access the Product Image Manager.', 'product-image-manager'),
                    array('status' => 403)
                );
            }
        }

        return $response;
    }

    /**
     * Preprocess GraphQL request data
     *
     * @param array $request_data  The GraphQL request data.
     */
    public function preprocess_graphql_request($request_data)
    {
        // Sanitize variables if present
        if (isset($request_data['variables']) && is_array($request_data['variables'])) {
            $request_data['variables'] = $this->sanitize_variables($request_data['variables']);
        }

        return $request_data;
    }

    /**
     * Check if the query contains PIM operations
     *
     * @param string $query  The GraphQL query string.
     * @return bool
     */
    private function is_pim_operation($query)
    {
        $pim_keywords = array(
            'pimSelectedCategories',
            'pimProducts',
            'pimProductImages',
            'pimDetachProductImage',
            'pimSetFeaturedImage',
            'pimUploadProductImages',
        );

        foreach ($pim_keywords as $keyword) {
            if (strpos($query, $keyword) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Validate nonce from request
     *
     * @param WP_REST_Request $request  The REST request.
     * @return bool
     */
    private function validate_nonce($request)
    {
        $nonce = null;

        // Try to get nonce from headers (preferred method)
        if ($request->get_header('X-WP-Nonce')) {
            $nonce = $request->get_header('X-WP-Nonce');
            if (wp_verify_nonce($nonce, 'wp_rest') !== 1) {
                // Try PIM-specific nonce
                if ($request->get_header('X-PIM-Nonce')) {
                    $nonce = $request->get_header('X-PIM-Nonce');
                    return wp_verify_nonce($nonce, 'pim_nonce') === 1;
                }
                return false;
            }
            return true;
        }

        // Try PIM-specific nonce
        if ($request->get_header('X-PIM-Nonce')) {
            $nonce = $request->get_header('X-PIM-Nonce');
            return wp_verify_nonce($nonce, 'pim_nonce') === 1;
        }

        // Try to get from body as fallback
        $body = $request->get_json_params();
        if (isset($body['_nonce'])) {
            $nonce = $body['_nonce'];
            return wp_verify_nonce($nonce, 'pim_nonce') === 1;
        }

        return false;
    }

    /**
     * Check if user can access the manager
     *
     * @return bool
     */
    private function can_access_manager()
    {
        return current_user_can('manage_woocommerce') || current_user_can('edit_products');
    }

    /**
     * Sanitize GraphQL variables recursively
     *
     * @param array $variables  The variables to sanitize.
     * @return array
     */
    private function sanitize_variables($variables)
    {
        $sanitized = array();

        foreach ($variables as $key => $value) {
            if (is_array($value)) {
                $sanitized[$key] = $this->sanitize_variables($value);
            } elseif (is_string($value)) {
                $sanitized[$key] = sanitize_text_field($value);
            } else {
                $sanitized[$key] = $value;
            }
        }

        return $sanitized;
    }
}
