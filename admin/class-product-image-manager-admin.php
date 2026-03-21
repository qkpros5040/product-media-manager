<?php

if (!defined('ABSPATH')) {
    exit;
}

class Product_Image_Manager_Admin
{
    private $plugin_name;
    private $version;

    public function __construct($plugin_name, $version)
    {
        $this->plugin_name = $plugin_name;
        $this->version = $version;
    }

    public function enqueue_styles($hook_suffix)
    {
        if ($hook_suffix !== 'toplevel_page_product-image-manager') {
            return;
        }

        wp_enqueue_style(
            $this->plugin_name . '-admin',
            PIM_PLUGIN_URL . 'admin/css/product-image-manager-admin.css',
            array(),
            $this->version,
            'all'
        );
    }

    public function enqueue_scripts($hook_suffix)
    {
        if ($hook_suffix !== 'toplevel_page_product-image-manager') {
            return;
        }

        wp_enqueue_script(
            $this->plugin_name . '-admin',
            PIM_PLUGIN_URL . 'admin/js/product-image-manager-admin.js',
            array(),
            $this->version,
            true
        );
    }

    public function add_plugin_admin_menu()
    {
        add_menu_page(
            __('Product Image Manager', 'product-image-manager'),
            __('Product Image Manager', 'product-image-manager'),
            'manage_woocommerce',
            'product-image-manager',
            array($this, 'render_settings_page'),
            'dashicons-format-gallery',
            56
        );
    }

    public function register_settings()
    {
        register_setting(
            'pim_settings_group',
            'pim_selected_categories',
            array($this, 'sanitize_selected_categories')
        );
    }

    public function sanitize_selected_categories($value)
    {
        if (!is_array($value)) {
            return array();
        }

        return array_values(array_filter(array_map('absint', $value)));
    }

    public function render_settings_page()
    {
        if (!current_user_can('manage_woocommerce')) {
            wp_die(esc_html__('You are not allowed to access this page.', 'product-image-manager'));
        }

        $categories = get_terms(array(
            'taxonomy' => 'product_cat',
            'hide_empty' => false,
        ));

        $selected = get_option('pim_selected_categories', array());

        include PIM_PLUGIN_DIR . 'admin/views/settings-page.php';
    }
}
