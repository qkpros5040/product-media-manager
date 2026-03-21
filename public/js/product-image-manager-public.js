(function () {
    'use strict';

    if (!window.wp || !window.wp.element) {
        return;
    }

    var element = window.wp.element;
    var createElement = element.createElement;
    var useEffect = element.useEffect;
    var useState = element.useState;
    var mountNode = document.getElementById('pim-app-root');

    if (!mountNode) {
        return;
    }

    async function requestGraphQL(query, variables) {
        var response = await fetch(pimConfig.graphqlUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': pimConfig.restNonce || '',
                'X-PIM-Nonce': pimConfig.nonce || ''
            },
            body: JSON.stringify({
                query: query,
                variables: variables || {}
            })
        });

        var payload = await response.json();
        if (payload.errors && payload.errors.length) {
            throw new Error(payload.errors[0].message || 'GraphQL request failed.');
        }

        return payload.data || {};
    }

    async function requestLegacy(action, payload) {
        var formData = new FormData();
        formData.append('action', action);
        formData.append('nonce', pimConfig.nonce);

        Object.keys(payload || {}).forEach(function (key) {
            formData.append(key, String(payload[key]));
        });

        var response = await fetch(pimConfig.ajaxUrl, {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        });

        var data = await response.json();
        if (!data.success) {
            throw new Error((data.data && data.data.message) || 'Request failed.');
        }

        return data.data || {};
    }

    async function uploadFilesLegacy(productId, files) {
        var formData = new FormData();
        formData.append('action', 'pim_upload_product_images');
        formData.append('nonce', pimConfig.nonce);
        formData.append('productId', String(productId));

        Array.prototype.forEach.call(files, function (file) {
            formData.append('files[]', file);
        });

        var response = await fetch(pimConfig.ajaxUrl, {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        });

        return response.json();
    }

    async function uploadFilesGraphQL(productId, files) {
        var operations = {
            query: 'mutation PIMUpload($productId: Int!, $files: [Upload]) { pimUploadProductImages(input: { productId: $productId, files: $files }) { success message results { success attachmentId url message } } }',
            variables: {
                productId: productId,
                files: []
            }
        };

        var map = {};
        var formData = new FormData();

        Array.prototype.forEach.call(files, function (file, index) {
            operations.variables.files.push(null);
            map[String(index)] = ['variables.files.' + index];
        });

        formData.append('operations', JSON.stringify(operations));
        formData.append('map', JSON.stringify(map));

        Array.prototype.forEach.call(files, function (file, index) {
            formData.append(String(index), file, file.name);
        });

        var response = await fetch(pimConfig.graphqlUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'X-WP-Nonce': pimConfig.restNonce || '',
                'X-PIM-Nonce': pimConfig.nonce || ''
            },
            body: formData
        });

        return response.json();
    }

    function PIMApp() {
        var _useState = useState([]);
        var categories = _useState[0];
        var setCategories = _useState[1];

        var _useState2 = useState([]);
        var products = _useState2[0];
        var setProducts = _useState2[1];

        var _useState3 = useState([]);
        var images = _useState3[0];
        var setImages = _useState3[1];

        var _useState4 = useState('');
        var status = _useState4[0];
        var setStatus = _useState4[1];

        var _useState5 = useState('');
        var search = _useState5[0];
        var setSearch = _useState5[1];

        var _useState6 = useState('categories');
        var level = _useState6[0];
        var setLevel = _useState6[1];

        var _useState7 = useState(null);
        var selectedCategory = _useState7[0];
        var setSelectedCategory = _useState7[1];

        var _useState8 = useState(null);
        var selectedProduct = _useState8[0];
        var setSelectedProduct = _useState8[1];

        var _useState9 = useState(null);
        var uploadFilesValue = _useState9[0];
        var setUploadFilesValue = _useState9[1];

        useEffect(function () {
            async function loadCategories() {
                if (!pimConfig.hasWpGraphql) {
                    setCategories(pimConfig.bootstrapCategories || []);

                    if (!pimConfig.bootstrapCategories || !pimConfig.bootstrapCategories.length) {
                        setStatus((pimConfig.messages && pimConfig.messages.noCategoriesConfigured) || 'No categories configured.');
                    } else {
                        setStatus((pimConfig.messages && pimConfig.messages.graphqlUnavailable) || 'GraphQL unavailable. Using settings categories.');
                    }

                    return;
                }

                try {
                    var data = await requestGraphQL(
                        'query PIMCategories { pimSelectedCategories { id name } }'
                    );
                    var loadedCategories = data.pimSelectedCategories || [];
                    if (!loadedCategories.length && pimConfig.bootstrapCategories && pimConfig.bootstrapCategories.length) {
                        setCategories(pimConfig.bootstrapCategories);
                    } else {
                        setCategories(loadedCategories);
                    }
                } catch (error) {
                    if (pimConfig.bootstrapCategories && pimConfig.bootstrapCategories.length) {
                        setCategories(pimConfig.bootstrapCategories);
                        setStatus((pimConfig.messages && pimConfig.messages.graphqlUnavailable) || 'GraphQL unavailable. Using settings categories.');
                    } else {
                        setStatus(error.message || ((pimConfig.messages && pimConfig.messages.noCategoriesConfigured) || 'No categories configured.'));
                    }
                }
            }

            loadCategories();
        }, []);

        useEffect(function () {
            if (!selectedCategory || !selectedCategory.id || level !== 'products') {
                return;
            }

            async function loadProducts() {
                try {
                    if (pimConfig.hasWpGraphql) {
                        var data = await requestGraphQL(
                            'query PIMProducts($categoryId: Int!, $search: String) { pimProducts(categoryId: $categoryId, search: $search) { id name hasImages } }',
                            { categoryId: selectedCategory.id, search: search }
                        );
                        setProducts(data.pimProducts || []);
                        return;
                    }

                    var legacyData = await requestLegacy('pim_load_products', {
                        categoryId: selectedCategory.id,
                        search: search || ''
                    });

                    setProducts(legacyData.products || []);
                } catch (error) {
                    try {
                        var fallbackData = await requestLegacy('pim_load_products', {
                            categoryId: selectedCategory.id,
                            search: search || ''
                        });

                        setProducts(fallbackData.products || []);
                        setStatus((pimConfig.messages && pimConfig.messages.graphqlUnavailable) || 'GraphQL unavailable. Using fallback data.');
                    } catch (fallbackError) {
                        setStatus(fallbackError.message || error.message);
                    }
                }
            }

            loadProducts();
        }, [selectedCategory, search, level]);

        async function fetchImages(activeProductId) {
            try {
                if (pimConfig.hasWpGraphql) {
                    var data = await requestGraphQL(
                        'query PIMProductImages($productId: Int!) { pimProductImages(productId: $productId) { featuredId images { id url fileName isFeatured } } }',
                        { productId: activeProductId }
                    );
                    setImages((data.pimProductImages && data.pimProductImages.images) || []);
                    return;
                }

                var legacyData = await requestLegacy('pim_load_product_images', {
                    productId: activeProductId
                });
                setImages(legacyData.images || []);
            } catch (error) {
                try {
                    var fallbackData = await requestLegacy('pim_load_product_images', {
                        productId: activeProductId
                    });
                    setImages(fallbackData.images || []);
                    setStatus((pimConfig.messages && pimConfig.messages.graphqlUnavailable) || 'GraphQL unavailable. Using fallback data.');
                } catch (fallbackError) {
                    setStatus(fallbackError.message || error.message);
                }
            }
        }

        async function onDetach(attachmentId) {
            try {
                if (pimConfig.hasWpGraphql) {
                    await requestGraphQL(
                        'mutation PIMDetach($productId: Int!, $attachmentId: Int!) { pimDetachProductImage(input: { productId: $productId, attachmentId: $attachmentId }) { success message } }',
                        { productId: selectedProduct.id, attachmentId: attachmentId }
                    );
                } else {
                    await requestLegacy('pim_detach_product_image', {
                        productId: selectedProduct.id,
                        attachmentId: attachmentId
                    });
                }

                await fetchImages(selectedProduct.id);
            } catch (error) {
                try {
                    await requestLegacy('pim_detach_product_image', {
                        productId: selectedProduct.id,
                        attachmentId: attachmentId
                    });
                    await fetchImages(selectedProduct.id);
                    setStatus((pimConfig.messages && pimConfig.messages.graphqlUnavailable) || 'GraphQL unavailable. Action completed with fallback.');
                } catch (fallbackError) {
                    setStatus(fallbackError.message || error.message);
                }
            }
        }

        async function onSetFeatured(attachmentId) {
            try {
                if (pimConfig.hasWpGraphql) {
                    await requestGraphQL(
                        'mutation PIMSetFeatured($productId: Int!, $attachmentId: Int!) { pimSetFeaturedImage(input: { productId: $productId, attachmentId: $attachmentId }) { success message } }',
                        { productId: selectedProduct.id, attachmentId: attachmentId }
                    );
                } else {
                    await requestLegacy('pim_set_featured_image', {
                        productId: selectedProduct.id,
                        attachmentId: attachmentId
                    });
                }

                await fetchImages(selectedProduct.id);
            } catch (error) {
                try {
                    await requestLegacy('pim_set_featured_image', {
                        productId: selectedProduct.id,
                        attachmentId: attachmentId
                    });
                    await fetchImages(selectedProduct.id);
                    setStatus((pimConfig.messages && pimConfig.messages.graphqlUnavailable) || 'GraphQL unavailable. Action completed with fallback.');
                } catch (fallbackError) {
                    setStatus(fallbackError.message || error.message);
                }
            }
        }

        async function onUpload(event) {
            event.preventDefault();

            if (!selectedProduct || !selectedProduct.id) {
                setStatus('Select a product first.');
                return;
            }

            if (!uploadFilesValue || !uploadFilesValue.length) {
                setStatus('Select at least one file to upload.');
                return;
            }

            try {
                var response;

                if (pimConfig.hasGraphqlUpload) {
                    response = await uploadFilesGraphQL(selectedProduct.id, uploadFilesValue);

                    if (response.errors && response.errors.length) {
                        throw new Error(response.errors[0].message || 'GraphQL upload failed.');
                    }

                    if (!response.data || !response.data.pimUploadProductImages || !response.data.pimUploadProductImages.success) {
                        throw new Error((response.data && response.data.pimUploadProductImages && response.data.pimUploadProductImages.message) || 'Upload failed.');
                    }
                } else {
                    response = await uploadFilesLegacy(selectedProduct.id, uploadFilesValue);
                    if (!response.success) {
                        throw new Error((response.data && response.data.message) || 'Upload failed.');
                    }
                }

                setStatus('Upload complete.');
                await fetchImages(selectedProduct.id);
            } catch (error) {
                if (pimConfig.hasGraphqlUpload) {
                    try {
                        var legacyResponse = await uploadFilesLegacy(selectedProduct.id, uploadFilesValue);
                        if (!legacyResponse.success) {
                            throw new Error((legacyResponse.data && legacyResponse.data.message) || 'Upload failed.');
                        }

                        setStatus((pimConfig.messages && pimConfig.messages.graphqlUnavailable) || 'GraphQL unavailable. Upload completed with fallback endpoint.');
                        await fetchImages(selectedProduct.id);
                        return;
                    } catch (fallbackError) {
                        setStatus(fallbackError.message || error.message || 'Upload failed.');
                        return;
                    }
                }

                setStatus(error.message || 'Upload failed.');
            }
        }

        function goToCategories() {
            setLevel('categories');
            setSelectedCategory(null);
            setSelectedProduct(null);
            setProducts([]);
            setImages([]);
            setSearch('');
        }

        function goToProducts() {
            if (!selectedCategory) {
                return;
            }

            setLevel('products');
            setSelectedProduct(null);
            setImages([]);
        }

        function openCategory(category) {
            setSelectedCategory({
                id: Number(category.id),
                name: category.name
            });
            setSelectedProduct(null);
            setImages([]);
            setSearch('');
            setLevel('products');
            setStatus('');
        }

        function toggleCategory(category) {
            var categoryId = Number(category.id);
            var isSameCategory = selectedCategory && Number(selectedCategory.id) === categoryId;

            if (isSameCategory) {
                setSelectedCategory(null);
                setSelectedProduct(null);
                setProducts([]);
                setImages([]);
                setSearch('');
                setLevel('categories');
                setStatus('');
                return;
            }

            openCategory(category);
        }

        async function openProduct(product) {
            var nextProduct = {
                id: Number(product.id),
                name: product.name
            };

            setSelectedProduct(nextProduct);
            setLevel('images');
            setStatus('');
            await fetchImages(nextProduct.id);
        }

        function goBackFolder() {
            if (level === 'images') {
                goToProducts();
                return;
            }

            if (level === 'products') {
                goToCategories();
            }
        }

        var breadcrumb = createElement(
            'div',
            { className: 'pim-breadcrumb' },
            createElement(
                'button',
                { type: 'button', className: 'pim-crumb', onClick: goToCategories },
                'Categories'
            ),
            selectedCategory ? createElement(
                'button',
                { type: 'button', className: 'pim-crumb', onClick: goToProducts },
                selectedCategory.name
            ) : null,
            selectedProduct ? createElement(
                'span',
                { className: 'pim-crumb pim-crumb-current' },
                selectedProduct.name
            ) : null
        );

        var selectedCategoryId = selectedCategory ? Number(selectedCategory.id) : null;
        var selectedProductId = selectedProduct ? Number(selectedProduct.id) : null;

        return createElement(
            'div',
            { className: 'pim-app' },
            createElement(
                'div',
                { className: 'pim-header' },
                createElement('h2', null, 'Product Image Manager'),
                createElement(
                    'div',
                    { className: 'pim-header-nav' },
                    level !== 'categories' ? createElement(
                        'button',
                        { type: 'button', className: 'pim-back-folder-btn', onClick: goBackFolder },
                        '\u2190 Back Folder'
                    ) : null,
                    breadcrumb
                )
            ),
            createElement(
                'div',
                { className: 'pim-explorer' },
                createElement(
                    'section',
                    { className: 'pim-panel pim-panel-tree' },
                    createElement('h3', null, 'Folder Hierarchy'),
                    createElement(
                        'div',
                        { className: 'pim-tree' },
                        !categories.length ? createElement('p', { className: 'pim-status' }, (pimConfig.messages && pimConfig.messages.noCategoriesConfigured) || 'No categories configured.') : null,
                        categories.map(function (category) {
                            var categoryId = Number(category.id);
                            var isActiveCategory = selectedCategoryId === categoryId;
                            return createElement(
                                'div',
                                { key: categoryId, className: 'pim-tree-node' },
                                createElement(
                                    'button',
                                    {
                                        className: 'pim-tree-item pim-tree-item-category' + (isActiveCategory ? ' is-active' : ''),
                                        type: 'button',
                                        onClick: function () {
                                            toggleCategory(category);
                                        }
                                    },
                                    createElement('span', { className: 'pim-tree-icon' }, '\ud83d\udcc1'),
                                    createElement('span', { className: 'pim-tree-label' }, category.name),
                                    createElement('span', { className: 'pim-tree-state' }, isActiveCategory ? '▼ Open' : '▶ Closed')
                                ),
                                isActiveCategory ? createElement(
                                    'div',
                                    { className: 'pim-tree-children' },
                                    createElement('input', {
                                        className: 'pim-search',
                                        type: 'search',
                                        value: search,
                                        onChange: function (event) {
                                            setSearch(event.target.value);
                                        },
                                        placeholder: 'Search products in this category'
                                    }),
                                    !products.length ? createElement('p', { className: 'pim-status' }, 'No products found in this category.') : null,
                                    products.map(function (product) {
                                        var productId = Number(product.id);
                                        var isActiveProduct = selectedProductId === productId;

                                        return createElement(
                                            'button',
                                            {
                                                key: productId,
                                                className: 'pim-tree-item pim-tree-item-product' + (isActiveProduct ? ' is-active' : ''),
                                                type: 'button',
                                                onClick: function () {
                                                    openProduct(product);
                                                }
                                            },
                                            createElement('span', { className: 'pim-tree-icon' }, product.hasImages ? '\ud83d\uddbc\ufe0f' : '\ud83d\uddc2\ufe0f'),
                                            createElement('span', { className: 'pim-tree-label' }, product.name)
                                        );
                                    })
                                ) : null
                            );
                        })
                    )
                ),
                createElement(
                    'section',
                    { className: 'pim-panel pim-panel-images' },
                    createElement('h3', null, selectedProduct ? ('Image Upload: ' + selectedProduct.name) : 'Image Upload'),
                    !selectedProduct ? createElement('p', { className: 'pim-status' }, 'Select a product in the hierarchy to upload and manage images.') : null,
                    selectedProduct ? createElement(
                        'form',
                        { className: 'pim-upload', onSubmit: onUpload },
                        createElement('input', {
                            type: 'file',
                            multiple: true,
                            accept: 'image/jpeg,image/png,image/webp',
                            onChange: function (event) {
                                setUploadFilesValue(event.target.files);
                            }
                        }),
                        createElement('button', { className: 'button button-primary', type: 'submit' }, 'Upload')
                    ) : null,
                    createElement('div', { className: 'pim-status' }, status),
                    createElement(
                        'div',
                        { className: 'pim-image-grid' },
                        selectedProduct && !images.length ? createElement('p', { className: 'pim-status' }, 'No images yet. Upload files to this product folder.') : null,
                        selectedProduct ? images.map(function (image) {
                            return createElement(
                                'article',
                                { className: 'pim-image-card', key: image.id },
                                createElement('img', { src: image.url, alt: image.fileName || '' }),
                                createElement(
                                    'div',
                                    { className: 'pim-image-meta' },
                                    createElement('span', null, image.fileName),
                                    image.isFeatured ? createElement('span', { className: 'pim-badge' }, 'Featured') : null
                                ),
                                createElement(
                                    'div',
                                    { className: 'pim-actions' },
                                    createElement('button', { className: 'button', type: 'button', onClick: function () { onSetFeatured(Number(image.id)); } }, 'Set Featured'),
                                    createElement('button', { className: 'button', type: 'button', onClick: function () { onDetach(Number(image.id)); } }, 'Detach')
                                )
                            );
                        }) : null
                    )
                )
            )
        );
    }

    element.render(createElement(PIMApp), mountNode);
})();
