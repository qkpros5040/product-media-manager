<?php

if (!defined('ABSPATH')) {
    exit;
}

class Product_Image_Manager_Media_Handler
{
    private $allowed_mimes = array('image/jpeg', 'image/png', 'image/webp');
    private $max_file_size = 8 * 1024 * 1024;

    public function get_product_images($product_id)
    {
        $featured_id = get_post_thumbnail_id($product_id);
        $gallery_raw = get_post_meta($product_id, '_product_image_gallery', true);
        $gallery_ids = array_filter(array_map('absint', explode(',', (string) $gallery_raw)));
        $gallery_ids = array_values(array_filter($gallery_ids, function ($id) use ($featured_id) {
            return (int) $id !== (int) $featured_id;
        }));

        $images = array();

        if ($featured_id) {
            $images[] = $this->map_attachment($featured_id, true);
        }

        foreach ($gallery_ids as $id) {
            $images[] = $this->map_attachment($id, false);
        }

        return array(
            'images' => array_values(array_filter($images)),
            'featuredId' => $featured_id ? (int) $featured_id : null,
        );
    }

    public function handle_upload_batch($product_id, $files)
    {
        $normalized = array();

        $count = isset($files['name']) && is_array($files['name']) ? count($files['name']) : 0;

        for ($i = 0; $i < $count; $i++) {
            $normalized[] = array(
                'name' => sanitize_file_name(wp_unslash($files['name'][$i])),
                'type' => sanitize_text_field(wp_unslash($files['type'][$i])),
                'tmp_name' => $files['tmp_name'][$i],
                'error' => (int) $files['error'][$i],
                'size' => (int) $files['size'][$i],
            );
        }

        return $this->handle_upload_collection($product_id, $normalized);
    }

    public function handle_upload_collection($product_id, $normalized_files)
    {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';

        $responses = array();
        $has_error = false;

        foreach ($normalized_files as $single) {
            $single = array(
                'name' => isset($single['name']) ? sanitize_file_name((string) $single['name']) : 'upload.bin',
                'type' => isset($single['type']) ? sanitize_text_field((string) $single['type']) : '',
                'tmp_name' => isset($single['tmp_name']) ? (string) $single['tmp_name'] : '',
                'error' => isset($single['error']) ? (int) $single['error'] : 0,
                'size' => isset($single['size']) ? (int) $single['size'] : 0,
            );

            $validation = $this->validate_file($single);
            if (!$validation['success']) {
                $has_error = true;
                $responses[] = $validation;
                continue;
            }

            $renamed = $this->rename_with_sku($product_id, $single['name']);
            $single['name'] = $renamed;

            $upload = wp_handle_sideload($single, array('test_form' => false));
            if (isset($upload['error'])) {
                $has_error = true;
                $responses[] = array('success' => false, 'message' => $upload['error']);
                continue;
            }

            $attachment = array(
                'post_mime_type' => $upload['type'],
                'post_title' => sanitize_text_field(pathinfo($renamed, PATHINFO_FILENAME)),
                'post_content' => '',
                'post_status' => 'inherit',
            );

            $attachment_id = wp_insert_attachment($attachment, $upload['file'], $product_id);
            if (is_wp_error($attachment_id)) {
                $has_error = true;
                $responses[] = array('success' => false, 'message' => $attachment_id->get_error_message());
                continue;
            }

            $attachment_meta = wp_generate_attachment_metadata($attachment_id, $upload['file']);
            wp_update_attachment_metadata($attachment_id, $attachment_meta);

            if (!has_post_thumbnail($product_id)) {
                set_post_thumbnail($product_id, $attachment_id);
                $this->remove_from_gallery($product_id, $attachment_id);
            } else {
                $this->append_to_gallery($product_id, $attachment_id);
            }

            $responses[] = array(
                'success' => true,
                'attachmentId' => (int) $attachment_id,
                'url' => wp_get_attachment_url($attachment_id),
                'message' => __('Uploaded successfully.', 'product-image-manager'),
            );
        }

        return array(
            'success' => !$has_error,
            'results' => $responses,
        );
    }

    public function detach_image($product_id, $attachment_id)
    {
        if ((int) get_post_thumbnail_id($product_id) === $attachment_id) {
            delete_post_thumbnail($product_id);
        }

        $gallery_raw = get_post_meta($product_id, '_product_image_gallery', true);
        $gallery_ids = array_filter(array_map('absint', explode(',', (string) $gallery_raw)));
        $gallery_ids = array_values(array_filter($gallery_ids, function ($id) use ($attachment_id) {
            return (int) $id !== (int) $attachment_id;
        }));

        update_post_meta($product_id, '_product_image_gallery', implode(',', $gallery_ids));

        return array('success' => true, 'message' => __('Image detached.', 'product-image-manager'));
    }

    public function set_featured_image($product_id, $attachment_id)
    {
        $product_id = absint($product_id);
        $attachment_id = absint($attachment_id);

        $previous_featured_id = (int) get_post_thumbnail_id($product_id);

        $gallery_raw = get_post_meta($product_id, '_product_image_gallery', true);
        $original_gallery_ids = array_values(array_filter(array_map('absint', explode(',', (string) $gallery_raw))));

        $swap_index = array_search((int) $attachment_id, $original_gallery_ids, true);

        $updated = set_post_thumbnail($product_id, $attachment_id);
        if (!$updated) {
            return array('success' => false, 'message' => __('Unable to set featured image.', 'product-image-manager'));
        }

        // Keep gallery in sync:
        // - Remove the new featured image from gallery.
        // - Move the previous featured image into the gallery (swap), ideally at the spot
        //   where the new featured image came from.
        $gallery_ids = array_values(array_filter($original_gallery_ids, function ($id) use ($previous_featured_id, $attachment_id) {
            return (int) $id !== (int) $previous_featured_id && (int) $id !== (int) $attachment_id;
        }));

        if ($previous_featured_id && (int) $previous_featured_id !== (int) $attachment_id) {
            if ($swap_index !== false) {
                $swap_index = max(0, (int) $swap_index);
                if ($swap_index > count($gallery_ids)) {
                    $swap_index = count($gallery_ids);
                }
                array_splice($gallery_ids, $swap_index, 0, array((int) $previous_featured_id));
            } else {
                $gallery_ids[] = (int) $previous_featured_id;
            }
        }

        update_post_meta($product_id, '_product_image_gallery', implode(',', $gallery_ids));

        return array('success' => true, 'message' => __('Featured image updated.', 'product-image-manager'));
    }

    public function reorder_gallery_images($product_id, $attachment_ids)
    {
        $featured_id = (int) get_post_thumbnail_id($product_id);
        $gallery_raw = get_post_meta($product_id, '_product_image_gallery', true);
        $existing_ids = array_values(array_filter(array_map('absint', explode(',', (string) $gallery_raw)), function ($id) use ($featured_id) {
            return (int) $id !== $featured_id;
        }));

        if (empty($existing_ids)) {
            return array('success' => true, 'message' => __('Gallery order updated.', 'product-image-manager'));
        }

        $requested_ids = array_values(array_unique(array_filter(array_map('absint', (array) $attachment_ids))));
        $requested_ids = array_values(array_filter($requested_ids, function ($id) use ($existing_ids) {
            return in_array((int) $id, $existing_ids, true);
        }));

        $remaining_ids = array_values(array_filter($existing_ids, function ($id) use ($requested_ids) {
            return !in_array((int) $id, $requested_ids, true);
        }));

        $new_order = array_merge($requested_ids, $remaining_ids);
        update_post_meta($product_id, '_product_image_gallery', implode(',', $new_order));

        return array('success' => true, 'message' => __('Gallery order updated.', 'product-image-manager'));
    }

    private function validate_file($file)
    {
        if (!empty($file['error'])) {
            return array('success' => false, 'message' => __('Upload error occurred.', 'product-image-manager'));
        }

        if ($file['size'] > $this->max_file_size) {
            return array('success' => false, 'message' => __('File exceeds max size.', 'product-image-manager'));
        }

        if (!in_array($file['type'], $this->allowed_mimes, true)) {
            return array('success' => false, 'message' => __('Unsupported file type.', 'product-image-manager'));
        }

        return array('success' => true);
    }

    private function rename_with_sku($product_id, $original_name)
    {
        $sku = get_post_meta($product_id, '_sku', true);
        $sku = sanitize_title($sku);

        if (empty($sku)) {
            $sku = 'product-' . (int) $product_id;
        }

        $ext = strtolower(pathinfo($original_name, PATHINFO_EXTENSION));
        $next = $this->next_image_sequence($product_id, $sku);

        return $sku . '-' . $next . '.' . $ext;
    }

    private function next_image_sequence($product_id, $sku)
    {
        $images = $this->get_product_images($product_id);
        $highest = 0;

        foreach ($images['images'] as $image) {
            if (empty($image['fileName'])) {
                continue;
            }

            if (preg_match('/^' . preg_quote($sku, '/') . '-(\d+)\./', $image['fileName'], $matches)) {
                $highest = max($highest, (int) $matches[1]);
            }
        }

        return $highest + 1;
    }

    private function append_to_gallery($product_id, $attachment_id)
    {
        $gallery_raw = get_post_meta($product_id, '_product_image_gallery', true);
        $gallery_ids = array_filter(array_map('absint', explode(',', (string) $gallery_raw)));

        if (!in_array((int) $attachment_id, $gallery_ids, true)) {
            $gallery_ids[] = (int) $attachment_id;
        }

        update_post_meta($product_id, '_product_image_gallery', implode(',', $gallery_ids));
    }

    private function remove_from_gallery($product_id, $attachment_id)
    {
        $gallery_raw = get_post_meta($product_id, '_product_image_gallery', true);
        $gallery_ids = array_filter(array_map('absint', explode(',', (string) $gallery_raw)));
        $gallery_ids = array_values(array_filter($gallery_ids, function ($id) use ($attachment_id) {
            return (int) $id !== (int) $attachment_id;
        }));

        update_post_meta($product_id, '_product_image_gallery', implode(',', $gallery_ids));
    }

    private function map_attachment($attachment_id, $is_featured)
    {
        $url = wp_get_attachment_image_url($attachment_id, 'thumbnail');
        if (!$url) {
            return null;
        }

        return array(
            'id' => (int) $attachment_id,
            'url' => $url,
            'fileName' => wp_basename(get_attached_file($attachment_id)),
            'isFeatured' => (bool) $is_featured,
        );
    }
}
