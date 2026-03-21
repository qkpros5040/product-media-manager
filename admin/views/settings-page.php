<?php
if (!defined('ABSPATH')) {
    exit;
}

$category_count = is_array($categories) ? count($categories) : 0;
$selected_count = is_array($selected) ? count($selected) : 0;
?>
<div class="wrap pim-admin-wrap">
    <div class="pim-admin-header">
        <div>
            <h1><?php echo esc_html__('Product Image Manager Settings', 'product-image-manager'); ?></h1>
            <p class="pim-subtitle"><?php echo esc_html__('Configure which WooCommerce categories are visible to managers in the media interface.', 'product-image-manager'); ?></p>
        </div>
        <div class="pim-header-badge">
            <strong id="pim-selected-count"><?php echo esc_html((string) $selected_count); ?></strong>
            <span><?php echo esc_html__('Selected Categories', 'product-image-manager'); ?></span>
        </div>
    </div>

    <form method="post" action="options.php" class="pim-settings-form">
        <?php settings_fields('pim_settings_group'); ?>

        <div class="pim-admin-grid">
            <section class="pim-admin-card pim-admin-card-main">
                <h2><?php echo esc_html__('Category Access', 'product-image-manager'); ?></h2>
                <p class="description"><?php echo esc_html__('Choose one or more categories that should appear in the Product Image Manager interface.', 'product-image-manager'); ?></p>

                <label class="screen-reader-text" for="pim-category-filter"><?php echo esc_html__('Filter categories', 'product-image-manager'); ?></label>
                <input
                    id="pim-category-filter"
                    class="regular-text pim-filter-input"
                    type="search"
                    placeholder="<?php echo esc_attr__('Search categories...', 'product-image-manager'); ?>"
                />

                <div class="pim-selection-actions">
                    <button type="button" class="button" id="pim-select-all"><?php echo esc_html__('Select All', 'product-image-manager'); ?></button>
                    <button type="button" class="button" id="pim-clear-all"><?php echo esc_html__('Clear All', 'product-image-manager'); ?></button>
                </div>

                <div class="pim-category-list" id="pim-category-list" aria-live="polite">
                    <?php foreach ($categories as $category) : ?>
                        <label class="pim-category-item" data-category-name="<?php echo esc_attr(strtolower($category->name)); ?>">
                            <input
                                type="checkbox"
                                name="pim_selected_categories[]"
                                value="<?php echo esc_attr($category->term_id); ?>"
                                <?php checked(in_array($category->term_id, $selected, true)); ?>
                            />
                            <span><?php echo esc_html($category->name); ?></span>
                        </label>
                    <?php endforeach; ?>
                </div>

                <div class="pim-form-footer">
                    <?php submit_button(__('Save Settings', 'product-image-manager'), 'primary', 'submit', false); ?>
                </div>
            </section>

            <aside class="pim-admin-card pim-admin-card-side">
                <h2><?php echo esc_html__('Overview', 'product-image-manager'); ?></h2>
                <ul class="pim-stats">
                    <li>
                        <strong><?php echo esc_html((string) $category_count); ?></strong>
                        <span><?php echo esc_html__('Available Categories', 'product-image-manager'); ?></span>
                    </li>
                    <li>
                        <strong id="pim-selected-count-side"><?php echo esc_html((string) $selected_count); ?></strong>
                        <span><?php echo esc_html__('Selected Categories', 'product-image-manager'); ?></span>
                    </li>
                </ul>

                <h3><?php echo esc_html__('Tips', 'product-image-manager'); ?></h3>
                <p class="description"><?php echo esc_html__('Select only the categories your team actively manages to keep the frontend interface clean and fast.', 'product-image-manager'); ?></p>
                <p class="description"><?php echo esc_html__('Use search and quick actions to configure large catalogs in seconds.', 'product-image-manager'); ?></p>
            </aside>
        </div>
    </form>
</div>
