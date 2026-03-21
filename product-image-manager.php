<?php
/**
 * Plugin Name: Product Image Manager
 * Description: Fullstack WooCommerce product image manager with folder navigation and AJAX uploads.
 * Version: 0.1.0
 * Author: Product Media Manager Team
 * Text Domain: product-image-manager
 */

if (!defined('ABSPATH')) {
    exit;
}

define('PIM_VERSION', '0.1.0');
define('PIM_PLUGIN_FILE', __FILE__);
define('PIM_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('PIM_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once PIM_PLUGIN_DIR . 'includes/class-product-image-manager-loader.php';
require_once PIM_PLUGIN_DIR . 'includes/class-product-image-manager-i18n.php';
require_once PIM_PLUGIN_DIR . 'services/class-product-image-manager-media-handler.php';
require_once PIM_PLUGIN_DIR . 'services/class-product-image-manager-graphql.php';
require_once PIM_PLUGIN_DIR . 'services/class-product-image-manager-graphql-handler.php';
require_once PIM_PLUGIN_DIR . 'ajax/class-product-image-manager-ajax-controller.php';
require_once PIM_PLUGIN_DIR . 'admin/class-product-image-manager-admin.php';
require_once PIM_PLUGIN_DIR . 'public/class-product-image-manager-public.php';
require_once PIM_PLUGIN_DIR . 'includes/class-product-image-manager.php';

function pim_activate_plugin()
{
    if (!get_option('pim_selected_categories')) {
        add_option('pim_selected_categories', array());
    }
}

function pim_deactivate_plugin()
{
    // Keep settings on deactivate by design.
}

register_activation_hook(__FILE__, 'pim_activate_plugin');
register_deactivation_hook(__FILE__, 'pim_deactivate_plugin');

function pim_run_plugin()
{
    $plugin = new Product_Image_Manager();
    $plugin->run();
}

pim_run_plugin();
