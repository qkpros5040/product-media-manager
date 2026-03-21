<?php

if (!defined('ABSPATH')) {
    exit;
}

class Product_Image_Manager
{
    private $loader;
    private $plugin_name;
    private $version;

    public function __construct()
    {
        $this->plugin_name = 'product-image-manager';
        $this->version = PIM_VERSION;

        $this->load_dependencies();
        $this->set_locale();
        $this->define_admin_hooks();
        $this->define_public_hooks();
        $this->define_ajax_hooks();
        $this->define_graphql_hooks();
    }

    private function load_dependencies()
    {
        $this->loader = new Product_Image_Manager_Loader();
    }

    private function set_locale()
    {
        $plugin_i18n = new Product_Image_Manager_i18n();
        $this->loader->add_action('plugins_loaded', $plugin_i18n, 'load_plugin_textdomain');
    }

    private function define_admin_hooks()
    {
        $plugin_admin = new Product_Image_Manager_Admin($this->plugin_name, $this->version);

        $this->loader->add_action('admin_menu', $plugin_admin, 'add_plugin_admin_menu');
        $this->loader->add_action('admin_init', $plugin_admin, 'register_settings');
        $this->loader->add_action('admin_enqueue_scripts', $plugin_admin, 'enqueue_styles');
        $this->loader->add_action('admin_enqueue_scripts', $plugin_admin, 'enqueue_scripts');
    }

    private function define_public_hooks()
    {
        $plugin_public = new Product_Image_Manager_Public($this->plugin_name, $this->version);

        $this->loader->add_action('wp_enqueue_scripts', $plugin_public, 'enqueue_styles');
        $this->loader->add_action('wp_enqueue_scripts', $plugin_public, 'enqueue_scripts');
        $this->loader->add_action('init', $plugin_public, 'register_shortcode');
    }

    private function define_ajax_hooks()
    {
        $controller = new Product_Image_Manager_Ajax_Controller();

        $this->loader->add_action('wp_ajax_pim_load_products', $controller, 'load_products');
        $this->loader->add_action('wp_ajax_pim_load_product_images', $controller, 'load_product_images');
        $this->loader->add_action('wp_ajax_pim_upload_product_images', $controller, 'upload_product_images');
        $this->loader->add_action('wp_ajax_pim_detach_product_image', $controller, 'detach_product_image');
        $this->loader->add_action('wp_ajax_pim_set_featured_image', $controller, 'set_featured_image');
    }

    private function define_graphql_hooks()
    {
        $graphql_service = new Product_Image_Manager_GraphQL();
        $this->loader->add_action('graphql_register_types', $graphql_service, 'register_schema');

        $graphql_handler = new Product_Image_Manager_GraphQL_Handler();
        $this->loader->add_action('rest_api_init', $graphql_handler, 'init');
    }

    public function run()
    {
        $this->loader->run();
    }
}
