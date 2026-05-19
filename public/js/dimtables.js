/**
 * DimTable - Βοηθητικό για αναζήτηση, ταξινόμηση και pagination σε πίνακες.
 *
 * Χρήση:
 *   new DimTable('table-id', { pageSize: 25 });
 *
 * HTML attributes:
 *   data-dimtable-search="table-id"     → input αναζήτησης
 *   data-dimtable-pagination="table-id" → container για pagination
 *   data-sortable                        → σε <th> για ενεργοποίηση ταξινόμησης
 */
class DimTable {
    constructor(tableId, options = {}) {
        this.table = document.getElementById(tableId);
        if (!this.table) return;

        this.pageSize = options.pageSize ?? 20;
        this.currentPage = 1;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.searchQuery = '';

        this.originalRows = Array.from(this.table.querySelectorAll('tbody tr'));
        this.filteredRows = [...this.originalRows];

        this.init();
    }

    init() {
        this.bindSearch();
        this.bindSortHeaders();
        this.render();
    }

    bindSearch() {
        const input = document.querySelector(`[data-dimtable-search="${this.table.id}"]`);
        if (!input) return;
        input.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.currentPage = 1;
            this.applyFilter();
            this.render();
        });
    }

    bindSortHeaders() {
        const headers = Array.from(this.table.querySelectorAll('thead th[data-sortable]'));
        headers.forEach((th, index) => {
            th.addEventListener('click', () => {
                if (this.sortColumn === index) {
                    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortColumn = index;
                    this.sortDirection = 'asc';
                }
                headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
                th.classList.add(`sort-${this.sortDirection}`);
                this.applySort();
                this.render();
            });
        });
    }

    applyFilter() {
        if (!this.searchQuery) {
            this.filteredRows = [...this.originalRows];
        } else {
            this.filteredRows = this.originalRows.filter(row =>
                row.textContent.toLowerCase().includes(this.searchQuery)
            );
        }
        this.applySort();
    }

    applySort() {
        if (this.sortColumn === null) return;
        this.filteredRows.sort((a, b) => {
            const aVal = a.cells[this.sortColumn]?.textContent.trim() ?? '';
            const bVal = b.cells[this.sortColumn]?.textContent.trim() ?? '';
            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);
            const comparison = (!isNaN(aNum) && !isNaN(bNum))
                ? aNum - bNum
                : aVal.localeCompare(bVal, 'el');
            return this.sortDirection === 'asc' ? comparison : -comparison;
        });
    }

    render() {
        this.originalRows.forEach(row => { row.style.display = 'none'; });

        const start = (this.currentPage - 1) * this.pageSize;
        const pageRows = this.filteredRows.slice(start, start + this.pageSize);
        pageRows.forEach(row => { row.style.display = ''; });

        this.renderPagination();
    }

    renderPagination() {
        const container = document.querySelector(`[data-dimtable-pagination="${this.table.id}"]`);
        if (!container) return;
        container.innerHTML = '';

        const totalPages = Math.ceil(this.filteredRows.length / this.pageSize);
        if (totalPages <= 1) return;

        const nav = document.createElement('nav');
        const ul = document.createElement('ul');
        ul.className = 'pagination pagination-sm mb-0';

        // Κουμπί Previous
        const prevLi = this.buildPageItem('&laquo;', this.currentPage === 1, () => {
            if (this.currentPage > 1) { this.currentPage--; this.render(); }
        });
        ul.appendChild(prevLi);

        // Σελίδες
        for (let i = 1; i <= totalPages; i++) {
            const li = this.buildPageItem(i, false, () => { this.currentPage = i; this.render(); });
            if (i === this.currentPage) li.classList.add('active');
            ul.appendChild(li);
        }

        // Κουμπί Next
        const nextLi = this.buildPageItem('&raquo;', this.currentPage === totalPages, () => {
            if (this.currentPage < totalPages) { this.currentPage++; this.render(); }
        });
        ul.appendChild(nextLi);

        nav.appendChild(ul);
        container.appendChild(nav);
    }

    buildPageItem(label, disabled, onClick) {
        const li = document.createElement('li');
        li.className = `page-item${disabled ? ' disabled' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.innerHTML = label;
        a.addEventListener('click', (e) => { e.preventDefault(); onClick(); });
        li.appendChild(a);
        return li;
    }
}
