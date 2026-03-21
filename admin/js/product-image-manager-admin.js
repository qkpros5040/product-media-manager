(function () {
    'use strict';

    var filterInput = document.getElementById('pim-category-filter');
    var categoryList = document.getElementById('pim-category-list');
    var selectAllButton = document.getElementById('pim-select-all');
    var clearAllButton = document.getElementById('pim-clear-all');
    var countPrimary = document.getElementById('pim-selected-count');
    var countSide = document.getElementById('pim-selected-count-side');

    if (!categoryList) {
        return;
    }

    var itemSelector = '.pim-category-item';
    var checkboxSelector = 'input[type="checkbox"]';

    function updateSelectedCount() {
        var selectedCount = categoryList.querySelectorAll(checkboxSelector + ':checked').length;

        if (countPrimary) {
            countPrimary.textContent = String(selectedCount);
        }

        if (countSide) {
            countSide.textContent = String(selectedCount);
        }
    }

    function setAllCheckboxes(checked) {
        var checkboxes = categoryList.querySelectorAll(checkboxSelector);
        checkboxes.forEach(function (checkbox) {
            if (checkbox.closest(itemSelector).style.display !== 'none') {
                checkbox.checked = checked;
            }
        });

        updateSelectedCount();
    }

    if (filterInput) {
        filterInput.addEventListener('input', function () {
            var term = filterInput.value.trim().toLowerCase();
            var items = categoryList.querySelectorAll(itemSelector);

            items.forEach(function (item) {
                var name = item.getAttribute('data-category-name') || '';
                item.style.display = name.indexOf(term) !== -1 ? '' : 'none';
            });
        });
    }

    if (selectAllButton) {
        selectAllButton.addEventListener('click', function () {
            setAllCheckboxes(true);
        });
    }

    if (clearAllButton) {
        clearAllButton.addEventListener('click', function () {
            setAllCheckboxes(false);
        });
    }

    categoryList.addEventListener('change', function (event) {
        if (event.target && event.target.matches(checkboxSelector)) {
            updateSelectedCount();
        }
    });

    updateSelectedCount();
})();
