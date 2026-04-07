import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

function defaultAccessor(row, key) {
  const value = row?.[key];
  if (value === null || value === undefined) return '';
  return value;
}

export default function DataTable({
  columns,
  data,
  rowKey,
  initialSortKey = null,
  initialSortDirection = 'asc',
  pageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  emptyMessage = 'No records found',
  loading = false,
  loadingMessage = 'Loading...',
  tableClassName = 'w-full',
  isRowExpanded,
  renderExpandedRow,
  expandedRowColSpan,
}) {
  const [sortState, setSortState] = useState({
    key: initialSortKey,
    direction: initialSortDirection,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);

  const sortedData = useMemo(() => {
    if (!sortState.key) return data;

    const column = columns.find((c) => c.key === sortState.key);
    const accessor = column?.sortAccessor || column?.accessor || ((row) => defaultAccessor(row, sortState.key));

    return [...data].sort((a, b) => {
      const left = accessor(a);
      const right = accessor(b);

      const leftVal = left === null || left === undefined ? '' : left;
      const rightVal = right === null || right === undefined ? '' : right;

      let cmp = 0;
      if (typeof leftVal === 'number' && typeof rightVal === 'number') {
        cmp = leftVal - rightVal;
      } else {
        cmp = String(leftVal).localeCompare(String(rightVal), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }

      return sortState.direction === 'asc' ? cmp : -cmp;
    });
  }, [data, columns, sortState]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / currentPageSize));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * currentPageSize;
  const pagedRows = sortedData.slice(start, start + currentPageSize);

  const onSort = (column) => {
    if (!column.sortable) return;

    setCurrentPage(1);
    setSortState((prev) => {
      if (prev.key !== column.key) {
        return { key: column.key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key: column.key, direction: 'desc' };
      }
      return { key: column.key, direction: 'asc' };
    });
  };

  const renderSortIcon = (column) => {
    if (!column.sortable) return null;
    if (sortState.key !== column.key) return <ChevronsUpDown className="w-3 h-3 opacity-60" />;
    return sortState.direction === 'asc'
      ? <ChevronUp className="w-3 h-3" />
      : <ChevronDown className="w-3 h-3" />;
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className={tableClassName}>
          <thead className="bg-gray-50 border-b">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 ${column.headerClassName || ''} ${column.sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : ''}`}
                  onClick={() => onSort(column)}
                >
                  <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                    <span>{column.header}</span>
                    {renderSortIcon(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-gray-500">
                  {loadingMessage}
                </td>
              </tr>
            ) : pagedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pagedRows.map((row, index) => {
                const key = rowKey ? rowKey(row) : index;
                const expanded = typeof isRowExpanded === 'function' ? isRowExpanded(row) : false;

                return (
                  <React.Fragment key={key}>
                    <tr className="hover:bg-gray-50">
                      {columns.map((column) => {
                        const content = column.render
                          ? column.render(row)
                          : (column.accessor ? column.accessor(row) : defaultAccessor(row, column.key));

                        return (
                          <td
                            key={column.key}
                            className={`px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 ${column.cellClassName || ''}`}
                          >
                            {content}
                          </td>
                        );
                      })}
                    </tr>

                    {expanded && typeof renderExpandedRow === 'function' && (
                      <tr>
                        <td colSpan={expandedRowColSpan || columns.length} className="p-0">
                          {renderExpandedRow(row)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 sm:px-4 py-2 border-t bg-gray-50 text-xs sm:text-sm">
        <div className="text-gray-600">
          Showing {sortedData.length === 0 ? 0 : start + 1}-{Math.min(start + currentPageSize, sortedData.length)} of {sortedData.length}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-gray-600">Rows:</label>
          <select
            value={currentPageSize}
            onChange={(e) => {
              setCurrentPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 border border-gray-300 rounded"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>

          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-gray-700">{safePage}/{totalPages}</span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
