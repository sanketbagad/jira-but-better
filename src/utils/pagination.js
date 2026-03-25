/**
 * Build paginated query helpers.
 * Returns { offset, limitVal, orderClause } from validated query params.
 */
export function paginationParams(query) {
  const page = parseInt(query.page) || 1;
  const limit = Math.min(parseInt(query.limit) || 50, 100);
  const offset = (page - 1) * limit;
  const sort = query.sort || 'created_at';
  const order = query.order === 'asc' ? 'ASC' : 'DESC';

  return { page, limit, offset, sort, order };
}

/**
 * Build paginated response envelope.
 */
export function paginatedResponse(data, total, page, limit) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}
