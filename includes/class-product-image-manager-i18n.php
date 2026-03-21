<?php

if (!defined('ABSPATH')) {
    exit;
}

class Product_Image_Manager_i18n
{
    public function load_plugin_textdomain()
    {
        load_plugin_textdomain(
            'product-image-manager',
            false,
            dirname(plugin_basename(PIM_PLUGIN_FILE)) . '/languages/'
        );
    }
}
