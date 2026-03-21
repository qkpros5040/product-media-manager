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

        wp_enqueue_script(
            $this->plugin_name . '-public',
            PIM_PLUGIN_URL . 'public/js/product-image-manager-public.js',
            array('wp-element'),
            $this->version,
            true
        );

        wp_localize_script($this->plugin_name . '-public', 'pimConfig', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'graphqlUrl' => site_url('/graphql'),
            'nonce' => wp_create_nonce('pim_ajax_nonce'),
            'selectedCategories' => array_map('absint', get_option('pim_selected_categories', array())),
            'canManage' => current_user_can('manage_woocommerce'),
            'hasWpGraphql' => function_exists('register_graphql_field'),
            'hasGraphqlUpload' => class_exists('WPGraphQL') && method_exists('WPGraphQL', 'get_type_registry') && is_object(WPGraphQL::get_type_registry()) && method_exists(WPGraphQL::get_type_registry(), 'get_type') && (bool) WPGraphQL::get_type_registry()->get_type('Upload'),
        ));
    }

    public function register_shortcode()
    {
        add_shortcode('product_image_manager', array($this, 'render_shortcode'));
    }

    public function render_shortcode()
    {
        if (!is_user_logged_in() || !current_user_can('manage_woocommerce')) {
            return '<p>' . esc_html__('You do not have permission to access Product Image Manager.', 'product-image-manager') . '</p>';
        }

        ob_start();
        include PIM_PLUGIN_DIR . 'public/views/app.php';
        return ob_get_clean();
    }
}
