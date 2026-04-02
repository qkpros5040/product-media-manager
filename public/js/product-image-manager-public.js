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

        var _useState14 = useState('');
        var debouncedSearch = _useState14[0];
        var setDebouncedSearch = _useState14[1];

        var _useState15 = useState(0);
        var productWindowStart = _useState15[0];
        var setProductWindowStart = _useState15[1];

        var _useState16 = useState(null);
        var draggingGalleryImageId = _useState16[0];
        var setDraggingGalleryImageId = _useState16[1];

        var _useState17 = useState(null);
        var galleryDropIndicator = _useState17[0];
        var setGalleryDropIndicator = _useState17[1];

        var _useState18 = useState(false);
        var isFeaturedDropActive = _useState18[0];
        var setIsFeaturedDropActive = _useState18[1];

        var _useState19 = useState(false);
        var isUploadDropActive = _useState19[0];
        var setIsUploadDropActive = _useState19[1];

        var activeProductsRequestRef = useRef(0);
        var fileInputRef = useRef(null);
        var productsViewportRef = useRef(null);
        var productsCacheRef = useRef({});
        var imagesCacheRef = useRef({});
        var productsPrefetchingRef = useRef({});

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
            var debounceHandle = window.setTimeout(function () {
                setDebouncedSearch(search);
            }, 180);

            return function () {
                window.clearTimeout(debounceHandle);
            };
        }, [search]);

        useEffect(function () {
            if (!selectedCategory || !selectedCategory.id) {
                return;
            }

            setProducts([]);
            setProductsOffset(0);
            setHasMoreProducts(true);
            setSelectedProduct(null);
            setImages([]);
            setProductWindowStart(0);

            loadProductsPage(true, 0);
        }, [selectedCategory]);

        useEffect(function () {
            if (!selectedCategory || !selectedCategory.id) {
                return;
            }

            setProducts([]);
            setProductsOffset(0);
            setHasMoreProducts(true);
            setProductWindowStart(0);
            loadProductsPage(true, 0);
        }, [debouncedSearch]);

        function getProductsCacheKey(categoryId, searchValue, offsetValue) {
            return [String(categoryId), String(searchValue || ''), String(offsetValue || 0)].join('::');
        }

        function invalidateCurrentCategoryProductsCache() {
            if (!selectedCategory || !selectedCategory.id) {
                return;
            }

            Object.keys(productsCacheRef.current).forEach(function (key) {
                if (key.indexOf(String(selectedCategory.id) + '::') === 0) {
                    delete productsCacheRef.current[key];
                }
            });
        }

        function getProductsColumnCount() {
            return window.matchMedia('(max-width: 900px)').matches ? 2 : 3;
        }

        function prefetchNextProductsPage(nextOffset) {
            if (!selectedCategory || !selectedCategory.id) {
                return;
            }

            var cacheKey = getProductsCacheKey(selectedCategory.id, debouncedSearch, nextOffset);
            if (productsCacheRef.current[cacheKey] || productsPrefetchingRef.current[cacheKey]) {
                return;
            }

            productsPrefetchingRef.current[cacheKey] = true;

            (async function () {
                try {
                    if (pimConfig.hasWpGraphql) {
                        var data = await requestGraphQL(
                            'query PIMProducts($categoryId: Int!, $search: String, $limit: Int, $offset: Int) { pimProducts(categoryId: $categoryId, search: $search, limit: $limit, offset: $offset) { id name hasImages permalink } }',
                            {
                                categoryId: selectedCategory.id,
                                search: debouncedSearch,
                                limit: PAGE_SIZE,
                                offset: nextOffset
                            }
                        );

                        productsCacheRef.current[cacheKey] = data.pimProducts || [];
                    } else {
                        var legacyData = await requestLegacy('pim_load_products', {
                            categoryId: selectedCategory.id,
                            search: debouncedSearch || '',
                            limit: PAGE_SIZE,
                            offset: nextOffset
                        });

                        productsCacheRef.current[cacheKey] = legacyData.products || [];
                    }
                } catch (error) {
                    // Best effort prefetch: fail silently.
                } finally {
                    delete productsPrefetchingRef.current[cacheKey];
                }
            })();
        }

        function updateImagesForProduct(productId, nextImages) {
            var cacheKey = String(productId);
            imagesCacheRef.current[cacheKey] = nextImages;
            setImages(nextImages);
        }

        async function loadProductsPage(reset, explicitOffset) {
            if (!selectedCategory || !selectedCategory.id) {
                return;
            }

            var requestId = activeProductsRequestRef.current + 1;
            activeProductsRequestRef.current = requestId;

            var offset = typeof explicitOffset === 'number' ? explicitOffset : (reset ? 0 : productsOffset);
            var cacheKey = getProductsCacheKey(selectedCategory.id, debouncedSearch, offset);
            var cachedItems = productsCacheRef.current[cacheKey];

            if (cachedItems) {
                setProducts(function (prev) {
                    return reset ? cachedItems : prev.concat(cachedItems);
                });
                setProductsOffset(offset + cachedItems.length);
                setHasMoreProducts(cachedItems.length === PAGE_SIZE);
                if (cachedItems.length === PAGE_SIZE) {
                    prefetchNextProductsPage(offset + cachedItems.length);
                }
                setIsLoadingProducts(false);
                return;
            }

            setIsLoadingProducts(true);

            try {
                var items = [];

                if (pimConfig.hasWpGraphql) {
                    var data = await requestGraphQL(
                        'query PIMProducts($categoryId: Int!, $search: String, $limit: Int, $offset: Int) { pimProducts(categoryId: $categoryId, search: $search, limit: $limit, offset: $offset) { id name hasImages permalink } }',
                        {
                            categoryId: selectedCategory.id,
                            search: debouncedSearch,
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
                        search: debouncedSearch || '',
                        limit: PAGE_SIZE,
                        offset: offset
                    });

                    if (activeProductsRequestRef.current !== requestId) {
                        return;
                    }

                    items = legacyData.products || [];
                }

                productsCacheRef.current[cacheKey] = items;

                setProducts(function (prev) {
                    return reset ? items : prev.concat(items);
                });
                setProductsOffset(offset + items.length);
                setHasMoreProducts(items.length === PAGE_SIZE);
                if (items.length === PAGE_SIZE) {
                    prefetchNextProductsPage(offset + items.length);
                }
                setIsLoadingProducts(false);
            } catch (error) {
                try {
                    var fallbackData = await requestLegacy('pim_load_products', {
                        categoryId: selectedCategory.id,
                        search: debouncedSearch || '',
                        limit: PAGE_SIZE,
                        offset: offset
                    });

                    if (activeProductsRequestRef.current !== requestId) {
                        return;
                    }

                    var fallbackItems = fallbackData.products || [];
                    productsCacheRef.current[cacheKey] = fallbackItems;
                    setProducts(function (prev) {
                        return reset ? fallbackItems : prev.concat(fallbackItems);
                    });
                    setProductsOffset(offset + fallbackItems.length);
                    setHasMoreProducts(fallbackItems.length === PAGE_SIZE);
                    if (fallbackItems.length === PAGE_SIZE) {
                        prefetchNextProductsPage(offset + fallbackItems.length);
                    }
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
            var cacheKey = String(activeProductId);
            var cachedImages = imagesCacheRef.current[cacheKey];

            if (cachedImages) {
                setImages(cachedImages);
                return;
            }

            try {
                if (pimConfig.hasWpGraphql) {
                    var data = await requestGraphQL(
                        'query PIMProductImages($productId: Int!) { pimProductImages(productId: $productId) { featuredId images { id url fileName isFeatured } } }',
                        { productId: activeProductId }
                    );
                    var graphqlImages = (data.pimProductImages && data.pimProductImages.images) || [];
                    imagesCacheRef.current[cacheKey] = graphqlImages;
                    setImages(graphqlImages);
                    return;
                }

                var legacyData = await requestLegacy('pim_load_product_images', {
                    productId: activeProductId
                });
                imagesCacheRef.current[cacheKey] = legacyData.images || [];
                setImages(legacyData.images || []);
            } catch (error) {
                try {
                    var fallbackData = await requestLegacy('pim_load_product_images', {
                        productId: activeProductId
                    });
                    imagesCacheRef.current[cacheKey] = fallbackData.images || [];
                    setImages(fallbackData.images || []);
                    setStatus((pimConfig.messages && pimConfig.messages.graphqlUnavailable) || 'GraphQL unavailable. Using fallback data.');
                } catch (fallbackError) {
                    setStatus(fallbackError.message || error.message);
                }
            }
        }

        async function onDetach(attachmentId) {
            var previousImages = images.slice();
            var optimisticImages = previousImages.filter(function (image) {
                return Number(image.id) !== Number(attachmentId);
            });
            updateImagesForProduct(selectedProduct.id, optimisticImages);

            try {
                delete imagesCacheRef.current[String(selectedProduct.id)];
                invalidateCurrentCategoryProductsCache();
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
                    updateImagesForProduct(selectedProduct.id, previousImages);
                    setStatus(fallbackError.message || error.message);
                }
            }
        }

        async function onSetFeatured(attachmentId) {
            var previousImages = images.slice();
            var optimisticImages = previousImages.map(function (image) {
                return Object.assign({}, image, {
                    isFeatured: Number(image.id) === Number(attachmentId)
                });
            });

            optimisticImages.sort(function (a, b) {
                if (a.isFeatured && !b.isFeatured) {
                    return -1;
                }

                if (!a.isFeatured && b.isFeatured) {
                    return 1;
                }

                return 0;
            });

            updateImagesForProduct(selectedProduct.id, optimisticImages);

            try {
                delete imagesCacheRef.current[String(selectedProduct.id)];
                invalidateCurrentCategoryProductsCache();
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
                    updateImagesForProduct(selectedProduct.id, previousImages);
                    setStatus(fallbackError.message || error.message);
                }
            }
        }

        async function onReorderGallery(nextGalleryIds, previousImages) {
            try {
                if (pimConfig.hasWpGraphql) {
                    await requestGraphQL(
                        'mutation PIMReorderGallery($productId: Int!, $attachmentIds: [Int]) { pimReorderGalleryImages(input: { productId: $productId, attachmentIds: $attachmentIds }) { success message } }',
                        {
                            productId: selectedProduct.id,
                            attachmentIds: nextGalleryIds
                        }
                    );
                    return;
                }

                await requestLegacy('pim_reorder_gallery_images', {
                    productId: selectedProduct.id,
                    attachmentIds: JSON.stringify(nextGalleryIds)
                });
            } catch (error) {
                try {
                    await requestLegacy('pim_reorder_gallery_images', {
                        productId: selectedProduct.id,
                        attachmentIds: JSON.stringify(nextGalleryIds)
                    });
                    setStatus((pimConfig.messages && pimConfig.messages.graphqlUnavailable) || 'GraphQL unavailable. Action completed with fallback.');
                } catch (fallbackError) {
                    updateImagesForProduct(selectedProduct.id, previousImages);
                    setStatus(fallbackError.message || error.message);
                }
            }
        }

        function moveGalleryImage(imageId, direction) {
            if (!selectedProduct || !selectedProduct.id) {
                return;
            }

            var previousImages = images.slice();
            var featured = previousImages.find(function (image) {
                return !!image.isFeatured;
            }) || null;
            var gallery = previousImages.filter(function (image) {
                return !image.isFeatured;
            });

            var index = gallery.findIndex(function (image) {
                return Number(image.id) === Number(imageId);
            });

            if (index === -1) {
                return;
            }

            var targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= gallery.length) {
                return;
            }

            var swapped = gallery.slice();
            var current = swapped[index];
            swapped[index] = swapped[targetIndex];
            swapped[targetIndex] = current;

            var nextImages = featured ? [featured].concat(swapped) : swapped;
            updateImagesForProduct(selectedProduct.id, nextImages);

            onReorderGallery(swapped.map(function (image) {
                return Number(image.id);
            }), previousImages);
        }

        function reorderGalleryByIds(sourceImageId, targetImageId, position) {
            if (!selectedProduct || !selectedProduct.id || Number(sourceImageId) === Number(targetImageId)) {
                return;
            }

            var previousImages = images.slice();
            var featured = previousImages.find(function (image) {
                return !!image.isFeatured;
            }) || null;
            var gallery = previousImages.filter(function (image) {
                return !image.isFeatured;
            });

            var fromIndex = gallery.findIndex(function (image) {
                return Number(image.id) === Number(sourceImageId);
            });

            var toIndex = gallery.findIndex(function (image) {
                return Number(image.id) === Number(targetImageId);
            });

            if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
                return;
            }

            var reorderedGallery = gallery.slice();
            var moved = reorderedGallery.splice(fromIndex, 1)[0];
            var safePosition = position === 'after' ? 'after' : 'before';
            var insertIndex = toIndex;

            if (safePosition === 'before') {
                insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
            } else {
                insertIndex = fromIndex < toIndex ? toIndex : toIndex + 1;
            }

            if (insertIndex < 0) {
                insertIndex = 0;
            }

            if (insertIndex > reorderedGallery.length) {
                insertIndex = reorderedGallery.length;
            }

            reorderedGallery.splice(insertIndex, 0, moved);

            var nextImages = featured ? [featured].concat(reorderedGallery) : reorderedGallery;
            updateImagesForProduct(selectedProduct.id, nextImages);

            onReorderGallery(reorderedGallery.map(function (image) {
                return Number(image.id);
            }), previousImages);
        }

        function onGalleryDragStart(imageId, event) {
            setDraggingGalleryImageId(Number(imageId));
            setGalleryDropIndicator(null);
            setIsFeaturedDropActive(false);

            if (event && event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', String(imageId));
            }
        }

        function onGalleryDragOver(targetImageId, event) {
            if (event) {
                event.preventDefault();

                if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = 'move';
                }
            }

            if (!draggingGalleryImageId || !event || !event.currentTarget) {
                return;
            }

            var bounds = event.currentTarget.getBoundingClientRect();
            var isBefore = (event.clientY - bounds.top) < (bounds.height / 2);
            var nextPosition = isBefore ? 'before' : 'after';

            setGalleryDropIndicator(function (prev) {
                if (prev && Number(prev.targetImageId) === Number(targetImageId) && prev.position === nextPosition) {
                    return prev;
                }

                return {
                    targetImageId: Number(targetImageId),
                    position: nextPosition
                };
            });
        }

        function onGalleryDrop(targetImageId, event) {
            if (event) {
                event.preventDefault();
            }

            var sourceImageId = draggingGalleryImageId;

            if (!sourceImageId && event && event.dataTransfer) {
                sourceImageId = Number(event.dataTransfer.getData('text/plain'));
            }

            setDraggingGalleryImageId(null);
            var dropPosition = galleryDropIndicator && Number(galleryDropIndicator.targetImageId) === Number(targetImageId)
                ? galleryDropIndicator.position
                : 'before';
            setGalleryDropIndicator(null);

            if (!sourceImageId) {
                return;
            }

            reorderGalleryByIds(Number(sourceImageId), Number(targetImageId), dropPosition);
        }

        function onGalleryDragEnd() {
            setDraggingGalleryImageId(null);
            setGalleryDropIndicator(null);
            setIsFeaturedDropActive(false);
        }

        function onFeaturedDragOver(event) {
            if (!event || !event.dataTransfer) {
                return;
            }

            // Ignore file drags (upload dropzone handles those).
            if (event.dataTransfer.files && event.dataTransfer.files.length) {
                return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setIsFeaturedDropActive(true);
        }

        function onFeaturedDragLeave() {
            setIsFeaturedDropActive(false);
        }

        function onFeaturedDrop(event) {
            if (event) {
                event.preventDefault();
            }

            setIsFeaturedDropActive(false);

            if (!selectedProduct || !selectedProduct.id) {
                return;
            }

            if (event && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
                return;
            }

            var sourceImageId = draggingGalleryImageId;

            if (!sourceImageId && event && event.dataTransfer) {
                sourceImageId = Number(event.dataTransfer.getData('text/plain'));
            }

            if (!sourceImageId) {
                return;
            }

            onSetFeatured(Number(sourceImageId));
        }

        function addFilesToQueue(files) {
            if (isUploading) {
                return;
            }

            var allowedTypes = {
                'image/jpeg': true,
                'image/png': true,
                'image/webp': true
            };

            var accepted = (files || []).filter(function (file) {
                return file && allowedTypes[file.type];
            });

            if (!accepted.length) {
                return;
            }

            var mapped = accepted.map(function (file, index) {
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
        }

        function onUploadDragOver(event) {
            if (!event || !event.dataTransfer) {
                return;
            }

            var types = event.dataTransfer.types || [];
            var hasFiles = Array.prototype.indexOf.call(types, 'Files') !== -1;
            if (!hasFiles) {
                return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setIsUploadDropActive(true);
        }

        function onUploadDragLeave() {
            setIsUploadDropActive(false);
        }

        function onUploadDrop(event) {
            if (event) {
                event.preventDefault();
            }

            setIsUploadDropActive(false);

            if (isUploading) {
                return;
            }

            if (!event || !event.dataTransfer || !event.dataTransfer.files || !event.dataTransfer.files.length) {
                return;
            }

            addFilesToQueue(Array.prototype.slice.call(event.dataTransfer.files));
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
                delete imagesCacheRef.current[String(selectedProduct.id)];
                invalidateCurrentCategoryProductsCache();
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

            addFilesToQueue(files);

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
            setProductWindowStart(0);
        }

        function goToProducts() {
            if (!selectedCategory) {
                return;
            }

            setLevel('products');
            setSelectedProduct(null);
            setImages([]);
            setProductWindowStart(0);
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
            setProductWindowStart(0);
        }

        function onProductsViewportScroll(event) {
            var viewport = event.target;
            var columns = getProductsColumnCount();
            var rowHeight = 122;
            var overscanRows = 3;
            var visibleRows = 8;
            var currentTopRow = Math.max(0, Math.floor(viewport.scrollTop / rowHeight) - overscanRows);
            var nextStart = currentTopRow * columns;

            if (nextStart !== productWindowStart) {
                setProductWindowStart(nextStart);
            }

            if (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 320 && hasMoreProducts && !isLoadingProducts) {
                loadProductsPage(false, productsOffset);
            }
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
        var featuredImage = null;
        var galleryImages = images;

        if (selectedProduct) {
            featuredImage = images.find(function (image) {
                return !!image.isFeatured;
            }) || null;
            galleryImages = images.filter(function (image) {
                return !image.isFeatured;
            });
        }

        var productColumns = getProductsColumnCount();
        var windowSize = productColumns * 12;
        var clampedStart = Math.max(0, Math.min(productWindowStart, Math.max(0, products.length - 1)));
        var visibleProducts = products.slice(clampedStart, clampedStart + windowSize);
        var topSpacerRows = Math.floor(clampedStart / productColumns);
        var remainingAfterWindow = Math.max(0, products.length - (clampedStart + visibleProducts.length));
        var bottomSpacerRows = Math.ceil(remainingAfterWindow / productColumns);

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
                                        {
                                            className: 'pim-products-viewport',
                                            ref: productsViewportRef,
                                            onScroll: onProductsViewportScroll
                                        },
                                        createElement('div', {
                                            className: 'pim-products-spacer',
                                            style: {
                                                height: String(topSpacerRows * 122) + 'px'
                                            }
                                        }),
                                        createElement(
                                            'div',
                                            { className: 'pim-products-grid' },
                                            !isLoadingProducts ? visibleProducts.map(function (product) {
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
                                        createElement('div', {
                                            className: 'pim-products-spacer',
                                            style: {
                                                height: String(bottomSpacerRows * 122) + 'px'
                                            }
                                        })
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
                            {
                                className: 'pim-uploader-box' + (isUploadDropActive ? ' is-drop-active' : ''),
                                onDragOver: onUploadDragOver,
                                onDragEnter: onUploadDragOver,
                                onDragLeave: onUploadDragLeave,
                                onDrop: onUploadDrop
                            },
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
                                    uploadQueue.length ? (uploadQueue.length + (uploadQueue.length === 1 ? ' file ready' : ' files ready')) : 'JPG, PNG, WEBP — or drag & drop'
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
                    selectedProduct ? createElement(
                        'div',
                        { className: 'pim-media-section' },
                        createElement('h4', { className: 'pim-media-section-title' }, 'Featured Image'),
                        featuredImage ? createElement(
                            'article',
                            {
                                className: 'pim-image-card pim-image-card-featured' + (isFeaturedDropActive ? ' is-drop-active' : ''),
                                key: 'featured-' + featuredImage.id,
                                onDragOver: onFeaturedDragOver,
                                onDragEnter: onFeaturedDragOver,
                                onDragLeave: onFeaturedDragLeave,
                                onDrop: onFeaturedDrop
                            },
                            createElement('img', { src: featuredImage.url, alt: featuredImage.fileName || '' }),
                            createElement(
                                'div',
                                { className: 'pim-image-meta' },
                                createElement('span', null, decodeEntities(featuredImage.fileName || 'Image')),
                                createElement('span', { className: 'pim-badge' }, 'Featured')
                            ),
                            createElement(
                                'div',
                                { className: 'pim-actions' },
                                createElement('button', {
                                    className: 'button button-danger',
                                    type: 'button',
                                    onClick: function () { onDetach(Number(featuredImage.id)); }
                                }, 'Detach')
                            )
                        ) : createElement(
                            'div',
                            {
                                className: 'pim-featured-empty' + (isFeaturedDropActive ? ' is-drop-active' : ''),
                                onDragOver: onFeaturedDragOver,
                                onDragEnter: onFeaturedDragOver,
                                onDragLeave: onFeaturedDragLeave,
                                onDrop: onFeaturedDrop
                            },
                            createElement('p', { className: 'pim-status' }, 'No featured image set. Drag a gallery image here.')
                        )
                    ) : null,
                    selectedProduct ? createElement(
                        'div',
                        { className: 'pim-media-section' },
                        createElement('h4', { className: 'pim-media-section-title' }, 'Gallery Images'),
                        !galleryImages.length ? createElement('p', { className: 'pim-status' }, 'No gallery images yet.') : null
                    ) : null,
                    createElement(
                        'div',
                        { className: 'pim-image-grid' },
                        selectedProduct ? galleryImages.map(function (image, galleryIndex) {
                            var isDragging = Number(draggingGalleryImageId) === Number(image.id);
                            var indicatorPosition = galleryDropIndicator && Number(galleryDropIndicator.targetImageId) === Number(image.id)
                                ? galleryDropIndicator.position
                                : '';
                            var dropIndicatorClass = indicatorPosition ? (' is-drop-target drop-' + indicatorPosition) : '';

                            return createElement(
                                'article',
                                {
                                    className: 'pim-image-card pim-image-card-gallery' + (isDragging ? ' is-dragging' : '') + dropIndicatorClass,
                                    key: image.id,
                                    draggable: true,
                                    onDragStart: function (event) { onGalleryDragStart(Number(image.id), event); },
                                    onDragOver: function (event) { onGalleryDragOver(Number(image.id), event); },
                                    onDrop: function (event) { onGalleryDrop(Number(image.id), event); },
                                    onDragEnd: onGalleryDragEnd
                                },
                                createElement('img', { src: image.url, alt: image.fileName || '' }),
                                createElement(
                                    'div',
                                    { className: 'pim-image-meta' },
                                    createElement('span', null, decodeEntities(image.fileName || 'Image')),
                                    createElement('span', { className: 'pim-badge pim-badge-muted' }, 'Gallery')
                                ),
                                createElement(
                                    'div',
                                    { className: 'pim-actions' },
                                    createElement('span', { className: 'pim-drag-handle', title: 'Drag to reorder', ariaHidden: 'true' }, '\u2630'),
                                    createElement('button', {
                                        className: 'button button-ghost',
                                        type: 'button',
                                        disabled: galleryIndex === 0,
                                        onClick: function () { moveGalleryImage(Number(image.id), 'up'); }
                                    }, 'Move Up'),
                                    createElement('button', {
                                        className: 'button button-ghost',
                                        type: 'button',
                                        disabled: galleryIndex === galleryImages.length - 1,
                                        onClick: function () { moveGalleryImage(Number(image.id), 'down'); }
                                    }, 'Move Down'),
                                    createElement('button', {
                                        className: 'button button-primary',
                                        type: 'button',
                                        onClick: function () { onSetFeatured(Number(image.id)); }
                                    }, 'Set Featured'),
                                    createElement('button', {
                                        className: 'button button-danger',
                                        type: 'button',
                                        onClick: function () { onDetach(Number(image.id)); }
                                    }, 'Detach')
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
