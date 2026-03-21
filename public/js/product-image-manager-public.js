(function () {
    'use strict';

    if (!window.wp || !window.wp.element) {
        return;
    }

    var PAGE_SIZE = 25;
    var element = window.wp.element;
    var createElement = element.createElement;
    var useEffect = element.useEffect;
    var useRef = element.useRef;
    var useState = element.useState;
    var mountNode = document.getElementById('pim-app-root');

    if (!mountNode) {
        return;
    }

    function decodeEntities(value) {
        var textarea = document.createElement('textarea');
        textarea.innerHTML = value || '';
        return textarea.value;
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

    function uploadSingleFileLegacy(productId, file, onProgress) {
        return new Promise(function (resolve, reject) {
            var formData = new FormData();
            formData.append('action', 'pim_upload_product_images');
            formData.append('nonce', pimConfig.nonce);
            formData.append('productId', String(productId));
            formData.append('files[]', file);

            var xhr = new XMLHttpRequest();
            xhr.open('POST', pimConfig.ajaxUrl, true);
            xhr.withCredentials = true;

            xhr.upload.addEventListener('progress', function (event) {
                if (!event.lengthComputable) {
                    return;
                }

                var percent = Math.round((event.loaded / event.total) * 100);
                onProgress(percent);
            });

            xhr.addEventListener('load', function () {
                var payload = null;

                try {
                    payload = JSON.parse(xhr.responseText || '{}');
                } catch (error) {
                    reject(new Error('Upload response parse failed.'));
                    return;
                }

                if (!payload || !payload.success) {
                    reject(new Error((payload && payload.data && payload.data.message) || 'Upload failed.'));
                    return;
                }

                resolve(payload);
            });

            xhr.addEventListener('error', function () {
                reject(new Error('Upload network error.'));
            });

            xhr.send(formData);
        });
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

        var _useState9 = useState(false);
        var isLoadingProducts = _useState9[0];
        var setIsLoadingProducts = _useState9[1];

        var _useState10 = useState(0);
        var productsOffset = _useState10[0];
        var setProductsOffset = _useState10[1];

        var _useState11 = useState(false);
        var hasMoreProducts = _useState11[0];
        var setHasMoreProducts = _useState11[1];

        var _useState12 = useState([]);
        var uploadQueue = _useState12[0];
        var setUploadQueue = _useState12[1];

        var _useState13 = useState(false);
        var isUploading = _useState13[0];
        var setIsUploading = _useState13[1];

        var activeProductsRequestRef = useRef(0);
        var fileInputRef = useRef(null);

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
                    var data = await requestGraphQL('query PIMCategories { pimSelectedCategories { id name } }');
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

            setProducts([]);
            setProductsOffset(0);
            setHasMoreProducts(true);
            setSelectedProduct(null);
            setImages([]);

            loadProductsPage(true, 0);
        }, [selectedCategory, search, level]);

        async function loadProductsPage(reset, explicitOffset) {
            if (!selectedCategory || !selectedCategory.id) {
                return;
            }

            var requestId = activeProductsRequestRef.current + 1;
            activeProductsRequestRef.current = requestId;

            var offset = typeof explicitOffset === 'number' ? explicitOffset : (reset ? 0 : productsOffset);
            setIsLoadingProducts(true);

            try {
                var items = [];

                if (pimConfig.hasWpGraphql) {
                    var data = await requestGraphQL(
                        'query PIMProducts($categoryId: Int!, $search: String, $limit: Int, $offset: Int) { pimProducts(categoryId: $categoryId, search: $search, limit: $limit, offset: $offset) { id name hasImages permalink } }',
                        {
                            categoryId: selectedCategory.id,
                            search: search,
                            limit: PAGE_SIZE,
                            offset: offset
                        }
                    );

                    if (activeProductsRequestRef.current !== requestId) {
                        return;
                    }

                    items = data.pimProducts || [];
                } else {
                    var legacyData = await requestLegacy('pim_load_products', {
                        categoryId: selectedCategory.id,
                        search: search || '',
                        limit: PAGE_SIZE,
                        offset: offset
                    });

                    if (activeProductsRequestRef.current !== requestId) {
                        return;
                    }

                    items = legacyData.products || [];
                }

                setProducts(function (prev) {
                    return reset ? items : prev.concat(items);
                });
                setProductsOffset(offset + items.length);
                setHasMoreProducts(items.length === PAGE_SIZE);
                setIsLoadingProducts(false);
            } catch (error) {
                try {
                    var fallbackData = await requestLegacy('pim_load_products', {
                        categoryId: selectedCategory.id,
                        search: search || '',
                        limit: PAGE_SIZE,
                        offset: offset
                    });

                    if (activeProductsRequestRef.current !== requestId) {
                        return;
                    }

                    var fallbackItems = fallbackData.products || [];
                    setProducts(function (prev) {
                        return reset ? fallbackItems : prev.concat(fallbackItems);
                    });
                    setProductsOffset(offset + fallbackItems.length);
                    setHasMoreProducts(fallbackItems.length === PAGE_SIZE);
                    setStatus((pimConfig.messages && pimConfig.messages.graphqlUnavailable) || 'GraphQL unavailable. Using fallback data.');
                    setIsLoadingProducts(false);
                } catch (fallbackError) {
                    if (activeProductsRequestRef.current !== requestId) {
                        return;
                    }

                    setStatus(fallbackError.message || error.message);
                    setIsLoadingProducts(false);
                    setHasMoreProducts(false);
                }
            }
        }

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

            if (!uploadQueue.length || isUploading) {
                return;
            }

            setIsUploading(true);

            var queueSnapshot = uploadQueue.map(function (item) {
                return item;
            });

            try {
                var failedCount = 0;

                for (var i = 0; i < queueSnapshot.length; i++) {
                    var entry = queueSnapshot[i];

                    setUploadQueue(function (prev) {
                        return prev.map(function (item) {
                            if (item.id !== entry.id) {
                                return item;
                            }

                            return Object.assign({}, item, {
                                status: 'uploading',
                                progress: 0,
                                errorMessage: ''
                            });
                        });
                    });

                    try {
                        await uploadSingleFileLegacy(selectedProduct.id, entry.file, function (progressValue) {
                            setUploadQueue(function (prev) {
                                return prev.map(function (item) {
                                    if (item.id !== entry.id) {
                                        return item;
                                    }

                                    return Object.assign({}, item, {
                                        progress: progressValue
                                    });
                                });
                            });
                        });

                        setUploadQueue(function (prev) {
                            return prev.map(function (item) {
                                if (item.id !== entry.id) {
                                    return item;
                                }

                                return Object.assign({}, item, {
                                    status: 'done',
                                    progress: 100
                                });
                            });
                        });
                    } catch (fileError) {
                        failedCount += 1;

                        setUploadQueue(function (prev) {
                            return prev.map(function (item) {
                                if (item.id !== entry.id) {
                                    return item;
                                }

                                return Object.assign({}, item, {
                                    status: 'failed',
                                    errorMessage: fileError.message || 'Upload failed.'
                                });
                            });
                        });
                    }
                }

                setStatus(failedCount ? 'Upload completed with some failures.' : 'Upload complete.');
                await fetchImages(selectedProduct.id);

                setUploadQueue(function (prev) {
                    prev.forEach(function (item) {
                        if (item.status === 'done' && item.previewUrl) {
                            URL.revokeObjectURL(item.previewUrl);
                        }
                    });

                    return prev.filter(function (item) {
                        return item.status !== 'done';
                    });
                });
            } finally {
                setIsUploading(false);
            }
        }

        function onFilesSelected(event) {
            if (isUploading) {
                return;
            }

            var files = Array.prototype.slice.call((event.target && event.target.files) || []);
            if (!files.length) {
                return;
            }

            var mapped = files.map(function (file, index) {
                return {
                    id: Date.now() + '-' + index + '-' + Math.random().toString(36).slice(2),
                    file: file,
                    progress: 0,
                    status: 'queued',
                    errorMessage: '',
                    previewUrl: URL.createObjectURL(file)
                };
            });

            setUploadQueue(function (prev) {
                return prev.concat(mapped);
            });

            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }

        function removeQueuedItem(id) {
            if (isUploading) {
                return;
            }

            setUploadQueue(function (prev) {
                var target = prev.find(function (item) {
                    return item.id === id;
                });

                if (target && target.previewUrl) {
                    URL.revokeObjectURL(target.previewUrl);
                }

                return prev.filter(function (item) {
                    return item.id !== id;
                });
            });
        }

        function moveQueuedItem(id, direction) {
            if (isUploading) {
                return;
            }

            setUploadQueue(function (prev) {
                var next = prev.slice();
                var index = next.findIndex(function (item) {
                    return item.id === id;
                });

                if (index === -1) {
                    return prev;
                }

                var targetIndex = direction === 'up' ? index - 1 : index + 1;
                if (targetIndex < 0 || targetIndex >= next.length) {
                    return prev;
                }

                var current = next[index];
                next[index] = next[targetIndex];
                next[targetIndex] = current;
                return next;
            });
        }

        function clearQueue() {
            if (isUploading) {
                return;
            }

            setUploadQueue(function (prev) {
                prev.forEach(function (item) {
                    if (item.previewUrl) {
                        URL.revokeObjectURL(item.previewUrl);
                    }
                });
                return [];
            });
        }

        function goToCategories() {
            setLevel('categories');
            setSelectedCategory(null);
            setSelectedProduct(null);
            setProducts([]);
            setProductsOffset(0);
            setHasMoreProducts(false);
            setImages([]);
            setSearch('');
            setStatus('');
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
                name: decodeEntities(category.name)
            });
            setSelectedProduct(null);
            setImages([]);
            setSearch('');
            setLevel('products');
            setStatus('');
            setProducts([]);
            setProductsOffset(0);
            setHasMoreProducts(true);
            setIsLoadingProducts(true);
        }

        function toggleCategory(category) {
            var categoryId = Number(category.id);
            var isSameCategory = selectedCategory && Number(selectedCategory.id) === categoryId;

            if (isSameCategory) {
                goToCategories();
                return;
            }

            openCategory(category);
        }

        async function openProduct(product) {
            var nextProduct = {
                id: Number(product.id),
                name: decodeEntities(product.name),
                permalink: product.permalink || ''
            };

            setSelectedProduct(nextProduct);
            setLevel('images');
            setStatus('');
            await fetchImages(nextProduct.id);
        }

        function openSelectedProductPage() {
            if (!selectedProduct || !selectedProduct.permalink) {
                return;
            }

            window.open(selectedProduct.permalink, '_blank', 'noopener');
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
                createElement(
                    'div',
                    { className: 'pim-header-main' },
                    createElement('span', { className: 'pim-eyebrow' }, 'Media Workspace'),
                    createElement('h2', null, 'Product Image Manager'),
                    createElement(
                        'p',
                        { className: 'pim-subtitle' },
                        selectedProduct ? 'Manage the featured image and gallery for the selected product.' : 'Browse categories, open a product, and manage uploads from one place.'
                    )
                ),
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
                    createElement(
                        'div',
                        { className: 'pim-panel-head' },
                        createElement('h3', null, 'Folder Hierarchy'),
                        createElement('p', { className: 'pim-panel-note' }, 'Open a category to reveal its products.')
                    ),
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
                                    createElement('span', { className: 'pim-tree-label' }, decodeEntities(category.name)),
                                    createElement('span', { className: 'pim-tree-state' }, isActiveCategory ? '\u25bc Open' : '\u25b6 Closed')
                                ),
                                isActiveCategory ? createElement(
                                    'div',
                                    { className: 'pim-tree-children' },
                                    createElement(
                                        'div',
                                        { className: 'pim-search-shell' },
                                        createElement('span', { className: 'pim-search-icon' }, '\ud83d\udd0d'),
                                        createElement('input', {
                                            className: 'pim-search',
                                            type: 'search',
                                            value: search,
                                            onChange: function (event) {
                                                setSearch(event.target.value);
                                            },
                                            placeholder: 'Search products in this category'
                                        }),
                                        search ? createElement(
                                            'button',
                                            {
                                                type: 'button',
                                                className: 'pim-search-clear',
                                                onClick: function () {
                                                    setSearch('');
                                                }
                                            },
                                            'Clear'
                                        ) : null
                                    ),
                                    isLoadingProducts ? createElement('p', { className: 'pim-status' }, 'Loading products...') : null,
                                    !isLoadingProducts && !products.length ? createElement('p', { className: 'pim-status' }, 'No products found in this category.') : null,
                                    createElement(
                                        'div',
                                        { className: 'pim-products-grid' },
                                        !isLoadingProducts ? products.map(function (product) {
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
                                                createElement(
                                                    'span',
                                                    { className: 'pim-tree-product-copy' },
                                                    createElement('span', { className: 'pim-tree-label' }, decodeEntities(product.name)),
                                                    createElement('span', { className: 'pim-tree-meta' }, product.hasImages ? 'Has images' : 'No images yet')
                                                )
                                            );
                                        }) : null
                                    ),
                                    hasMoreProducts ? createElement(
                                        'button',
                                        {
                                            type: 'button',
                                            className: 'button pim-load-more-btn',
                                            disabled: isLoadingProducts,
                                            onClick: function () {
                                                loadProductsPage(false, productsOffset);
                                            }
                                        },
                                        isLoadingProducts ? 'Loading...' : 'Load more'
                                    ) : null
                                ) : null
                            );
                        })
                    )
                ),
                createElement(
                    'section',
                    { className: 'pim-panel pim-panel-images' },
                    createElement(
                        'div',
                        { className: 'pim-panel-head' },
                        createElement('h3', null, selectedProduct ? ('Image Upload: ' + selectedProduct.name) : 'Image Upload'),
                        createElement('p', { className: 'pim-panel-note' }, selectedProduct ? 'Queue files, reorder them, and upload safely with per-file progress.' : 'Select a product in the hierarchy to begin.'),
                        selectedProduct ? createElement(
                            'button',
                            {
                                type: 'button',
                                className: 'button pim-open-product-btn',
                                onClick: openSelectedProductPage,
                                disabled: !selectedProduct.permalink
                            },
                            'Open Product'
                        ) : null
                    ),
                    !selectedProduct ? createElement('p', { className: 'pim-status' }, 'Select a product in the hierarchy to upload and manage images.') : null,
                    selectedProduct ? createElement(
                        'form',
                        { className: 'pim-upload', onSubmit: onUpload },
                        createElement(
                            'div',
                            { className: 'pim-uploader-box' },
                            createElement(
                                'div',
                                { className: 'pim-file-picker' },
                                createElement('input', {
                                    id: 'pim-file-input',
                                    ref: fileInputRef,
                                    className: 'pim-hidden-input',
                                    type: 'file',
                                    multiple: true,
                                    accept: 'image/jpeg,image/png,image/webp',
                                    disabled: isUploading,
                                    onChange: onFilesSelected
                                }),
                                createElement('label', { htmlFor: 'pim-file-input', className: 'pim-file-picker-btn' }, 'Choose images'),
                                createElement(
                                    'span',
                                    { className: 'pim-file-picker-text' },
                                    uploadQueue.length ? (uploadQueue.length + (uploadQueue.length === 1 ? ' file ready' : ' files ready')) : 'JPG, PNG, WEBP'
                                )
                            ),
                            createElement(
                                'div',
                                { className: 'pim-upload-actions-row' },
                                createElement('button', {
                                    className: 'button button-primary',
                                    type: 'submit',
                                    disabled: isUploading || !uploadQueue.length
                                }, isUploading ? 'Uploading...' : 'Upload Selected'),
                                createElement('button', {
                                    className: 'button',
                                    type: 'button',
                                    onClick: clearQueue,
                                    disabled: isUploading || !uploadQueue.length
                                }, 'Clear')
                            )
                        ),
                        createElement(
                            'div',
                            { className: 'pim-upload-queue' },
                            createElement(
                                'div',
                                { className: 'pim-upload-queue-head' },
                                createElement('strong', null, 'Upload queue'),
                                createElement('span', null, uploadQueue.length ? (uploadQueue.length + ' selected') : 'Empty')
                            ),
                            !uploadQueue.length ? createElement('p', { className: 'pim-status' }, 'No files selected.') : null,
                            uploadQueue.map(function (entry, index) {
                                var canMoveUp = index > 0;
                                var canMoveDown = index < uploadQueue.length - 1;

                                return createElement(
                                    'article',
                                    { key: entry.id, className: 'pim-upload-item pim-upload-item-' + entry.status },
                                    createElement('img', { className: 'pim-upload-preview', src: entry.previewUrl, alt: entry.file.name }),
                                    createElement(
                                        'div',
                                        { className: 'pim-upload-meta' },
                                        createElement('div', { className: 'pim-upload-name', title: entry.file.name }, entry.file.name),
                                        createElement('div', { className: 'pim-upload-size' }, (entry.file.size / 1024).toFixed(0) + ' KB'),
                                        createElement(
                                            'div',
                                            { className: 'pim-upload-progress-wrap' },
                                            createElement('div', {
                                                className: 'pim-upload-progress-bar',
                                                style: { width: String(entry.progress) + '%' }
                                            }),
                                            createElement('span', { className: 'pim-upload-progress-text' }, entry.status === 'failed' ? (entry.errorMessage || 'Failed') : (String(entry.progress) + '%'))
                                        )
                                    ),
                                    createElement(
                                        'div',
                                        { className: 'pim-upload-controls' },
                                        createElement('button', {
                                            type: 'button',
                                            className: 'button button-small',
                                            disabled: isUploading || !canMoveUp,
                                            onClick: function () { moveQueuedItem(entry.id, 'up'); }
                                        }, '\u2191'),
                                        createElement('button', {
                                            type: 'button',
                                            className: 'button button-small',
                                            disabled: isUploading || !canMoveDown,
                                            onClick: function () { moveQueuedItem(entry.id, 'down'); }
                                        }, '\u2193'),
                                        createElement('button', {
                                            type: 'button',
                                            className: 'button button-small',
                                            disabled: isUploading,
                                            onClick: function () { removeQueuedItem(entry.id); }
                                        }, 'Remove')
                                    )
                                );
                            })
                        )
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
                                    createElement('span', null, decodeEntities(image.fileName || 'Image')),
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
