<?php
if (!defined('ABSPATH')) {
    exit;
}
?>
<div class="wrap">
    <h1><?php echo esc_html__('Product Image Manager Settings', 'product-image-manager'); ?></h1>
    <form method="post" action="options.php">
        <?php settings_fields('pim_settings_group'); ?>

        <table class="form-table" role="presentation">
            <tr>
                <th scope="row">
                    <label for="pim_selected_categories"><?php echo esc_html__('Allowed Product Categories', 'product-image-manager'); ?></label>
                </th>
                <td>
                    <select id="pim_selected_categories" name="pim_selected_categories[]" multiple style="min-width: 320px; min-height: 200px;">
                        <?php foreach ($categories as $category) : ?>
                            <option value="<?php echo esc_attr($category->term_id); ?>" <?php selected(in_array($category->term_id, $selected, true)); ?>>
                                <?php echo esc_html($category->name); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                    <p class="description">
                        <?php echo esc_html__('Only selected categories will appear in the frontend manager.', 'product-image-manager'); ?>
                    </p>
                </td>
            </tr>
        </table>

        <?php submit_button(); ?>
    </form>
</div>
