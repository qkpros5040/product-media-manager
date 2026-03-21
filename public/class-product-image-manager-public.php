<?php

if (!defined('ABSPATH')) {
    exit;
}

class Product_Image_Manager_Public
{
    private $plugin_name;
    private $version;

    public function __construct($plugin_name, $version)
    {
        $this->plugin_name = $plugin_name;
        $this->version = $version;
    }

    public function enqueue_styles()
    {
        if (!is_user_logged_in()) {
            return;
        }

        wp_enqueue_style(
            $this->plugin_name . '-public',
            PIM_PLUGIN_URL . 'public/css/product-image-manager-public.css',
            array(),
            $this->version,
            'all'
        );
    }

    public function enqueue_scripts()
    {
        if (!is_user_logged_in()) {
            return;
        }

        if (!$this->can_access_manager()) {
            return;
        }

        $selected_categories = array_map('absint', get_option('pim_selected_categories', array()));
        $terms = get_terms(array(
            'taxonomy' => 'product_cat',
            'hide_empty' => false,
            'include' => $selected_categories,
        ));

        $bootstrap_categories = array();
        if (!is_wp_error($terms) && is_array($terms)) {
            foreach ($terms as $term) {
                $bootstrap_categories[] = array(
                    'id' => (int) $term->term_id,
                    'name' => $term->name,
                );
            }
        }

        wp_enqueue_script(
            $this->plugin_name . '-public',
            PIM_PLUGIN_URL . 'public/js/product-image-manager-public.js',
            array('wp-element'),
            $this->version,
            true
        );

        wp_localize_script($this->plugin_name . '-public', 'pimConfig', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'graphqlUrl' => home_url('/graphql'),
            'nonce' => wp_create_nonce('pim_ajax_nonce'),
            'restNonce' => wp_create_nonce('wp_rest'),
            'selectedCategories' => $selected_categories,
            'bootstrapCategories' => $bootstrap_categories,
            'canManage' => $this->can_access_manager(),
            'hasWpGraphql' => function_exists('register_graphql_field'),
            'hasGraphqlUpload' => class_exists('WPGraphQL') && method_exists('WPGraphQL', 'get_type_registry') && is_object(WPGraphQL::get_type_registry()) && method_exists(WPGraphQL::get_type_registry(), 'get_type') && (bool) WPGraphQL::get_type_registry()->get_type('Upload'),
            'messages' => array(
                'noCategoriesConfigured' => __('No categories are configured. Go to Product Image Manager Settings and select at least one category.', 'product-image-manager'),
                'graphqlUnavailable' => __('WPGraphQL is unavailable. Showing configured categories from settings.', 'product-image-manager'),
            ),
        ));
    }

    public function register_shortcode()
    {
        add_shortcode('product_image_manager', array($this, 'render_shortcode'));
    }

    public function render_shortcode()
    {
        if (!is_user_logged_in() || !$this->can_access_manager()) {
            return '<p>' . esc_html__('You do not have permission to access Product Image Manager.', 'product-image-manager') . '</p>';
        }

        ob_start();
        include PIM_PLUGIN_DIR . 'public/views/app.php';
        return ob_get_clean();
    }

    private function can_access_manager()
    {
        return current_user_can('manage_woocommerce') || current_user_can('edit_products');
    }
}
