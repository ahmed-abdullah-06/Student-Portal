/**
 * Shared pagination helper.
 * Query params: page (1-based), limit (default 20, max 100), search (optional),
 * sort (column), order (asc|desc).
 */

function parsePagination(req, { defaultLimit = 20, maxLimit = 100, sortable = [] } = {}) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit, 10) || defaultLimit));
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const order = req.query.order === 'asc' ? 'asc' : 'desc';
  let sort = typeof req.query.sort === 'string' ? req.query.sort : null;
  if (sort && !sortable.includes(sort)) sort = null;
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
    search,
    sort,
    order,
  };
}

function pageMeta({ page, limit, total }) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Wrap a Prisma findMany + count into a paginated envelope. */
async function paginate(findManyFn, countFn, args, meta) {
  const [items, total] = await Promise.all([findManyFn(), countFn()]);
  return { items, pagination: pageMeta({ ...meta, total }) };
}

module.exports = { parsePagination, pageMeta, paginate };
