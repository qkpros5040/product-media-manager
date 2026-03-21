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
                'Content-Type': 'application/json'
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

        var _useState6 = useState(null);
        var categoryId = _useState6[0];
        var setCategoryId = _useState6[1];

        var _useState7 = useState(null);
        var productId = _useState7[0];
        var setProductId = _useState7[1];

        var _useState8 = useState(null);
        var uploadFilesValue = _useState8[0];
        var setUploadFilesValue = _useState8[1];

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
            if (!categoryId) {
                return;
            }

            async function loadProducts() {
                try {
                    var data = await requestGraphQL(
                        'query PIMProducts($categoryId: Int!, $search: String) { pimProducts(categoryId: $categoryId, search: $search) { id name hasImages } }',
                        { categoryId: categoryId, search: search }
                    );
                    setProducts(data.pimProducts || []);
                } catch (error) {
                    setStatus(error.message);
                }
            }

            loadProducts();
        }, [categoryId, search]);

        async function fetchImages(activeProductId) {
            try {
                var data = await requestGraphQL(
                    'query PIMProductImages($productId: Int!) { pimProductImages(productId: $productId) { featuredId images { id url fileName isFeatured } } }',
                    { productId: activeProductId }
                );
                setImages((data.pimProductImages && data.pimProductImages.images) || []);
            } catch (error) {
                setStatus(error.message);
            }
        }

        async function onDetach(attachmentId) {
            try {
                await requestGraphQL(
                    'mutation PIMDetach($productId: Int!, $attachmentId: Int!) { pimDetachProductImage(input: { productId: $productId, attachmentId: $attachmentId }) { success message } }',
                    { productId: productId, attachmentId: attachmentId }
                );
                await fetchImages(productId);
            } catch (error) {
                setStatus(error.message);
            }
        }

        async function onSetFeatured(attachmentId) {
            try {
                await requestGraphQL(
                    'mutation PIMSetFeatured($productId: Int!, $attachmentId: Int!) { pimSetFeaturedImage(input: { productId: $productId, attachmentId: $attachmentId }) { success message } }',
                    { productId: productId, attachmentId: attachmentId }
                );
                await fetchImages(productId);
            } catch (error) {
                setStatus(error.message);
            }
        }

        async function onUpload(event) {
            event.preventDefault();

            if (!productId) {
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
                    response = await uploadFilesGraphQL(productId, uploadFilesValue);

                    if (response.errors && response.errors.length) {
                        throw new Error(response.errors[0].message || 'GraphQL upload failed.');
                    }

                    if (!response.data || !response.data.pimUploadProductImages || !response.data.pimUploadProductImages.success) {
                        throw new Error((response.data && response.data.pimUploadProductImages && response.data.pimUploadProductImages.message) || 'Upload failed.');
                    }
                } else {
                    response = await uploadFilesLegacy(productId, uploadFilesValue);
                    if (!response.success) {
                        throw new Error((response.data && response.data.message) || 'Upload failed.');
                    }
                }

                setStatus('Upload complete.');
                await fetchImages(productId);
            } catch (error) {
                setStatus(error.message || 'Upload failed.');
            }
        }

        var breadcrumb = 'Categories';
        if (categoryId && productId) {
            breadcrumb = 'Categories / Products / Images';
        } else if (categoryId) {
            breadcrumb = 'Categories / Products';
        }

        return createElement(
            'div',
            { className: 'pim-app' },
            createElement(
                'div',
                { className: 'pim-header' },
                createElement('h2', null, 'Product Image Manager (React + GraphQL)'),
                createElement('div', { className: 'pim-breadcrumb' }, breadcrumb)
            ),
            createElement(
                'div',
                { className: 'pim-columns' },
                createElement(
                    'section',
                    { className: 'pim-panel' },
                    createElement('h3', null, 'Categories'),
                    createElement(
                        'div',
                        { className: 'pim-folder-grid' },
                        !categories.length ? createElement('p', { className: 'pim-status' }, (pimConfig.messages && pimConfig.messages.noCategoriesConfigured) || 'No categories configured.') : null,
                        categories.map(function (category) {
                            return createElement(
                                'button',
                                {
                                    key: category.id,
                                    className: 'pim-folder',
                                    type: 'button',
                                    onClick: function () {
                                        setCategoryId(Number(category.id));
                                        setProductId(null);
                                        setImages([]);
                                    }
                                },
                                createElement('span', { className: 'pim-folder-icon pim-folder-neutral' }),
                                createElement('span', { className: 'pim-folder-label' }, category.name)
                            );
                        })
                    )
                ),
                createElement(
                    'section',
                    { className: 'pim-panel' },
                    createElement('h3', null, 'Products'),
                    createElement('input', {
                        className: 'pim-search',
                        type: 'search',
                        value: search,
                        onChange: function (event) {
                            setSearch(event.target.value);
                        },
                        placeholder: 'Search products'
                    }),
                    createElement(
                        'div',
                        { className: 'pim-folder-grid' },
                        products.map(function (product) {
                            return createElement(
                                'button',
                                {
                                    key: product.id,
                                    className: 'pim-folder',
                                    type: 'button',
                                    onClick: function () {
                                        var id = Number(product.id);
                                        setProductId(id);
                                        fetchImages(id);
                                    }
                                },
                                createElement('span', { className: 'pim-folder-icon ' + (product.hasImages ? 'pim-folder-green' : 'pim-folder-red') }),
                                createElement('span', { className: 'pim-folder-label' }, product.name)
                            );
                        })
                    )
                ),
                createElement(
                    'section',
                    { className: 'pim-panel' },
                    createElement('h3', null, 'Images'),
                    createElement(
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
                    ),
                    createElement('div', { className: 'pim-status' }, status),
                    createElement(
                        'div',
                        { className: 'pim-image-grid' },
                        images.map(function (image) {
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
                        })
                    )
                )
            )
        );
    }

    element.render(createElement(PIMApp), mountNode);
})();
