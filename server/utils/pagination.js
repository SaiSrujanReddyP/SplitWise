/**
 * Pagination Utilities
 * 
 * Design Decision: Cursor-based pagination for scalability
 * - Offset pagination (skip/limit) degrades at scale (O(n) for skip)
 * - Cursor pagination maintains O(1) performance regardless of page
 * - Uses indexed fields (createdAt, _id) for efficient cursor queries
 * 
 * Supports both:
 * - Offset pagination (for simple use cases, backwards compatibility)
 * - Cursor pagination (for infinite scroll, real-time feeds)
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse pagination parameters from request query
 */
const parsePaginationParams = (query) => {
  const limit = Math.min(
    Math.max(parseInt(query.limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );
  
  const page = Math.max(parseInt(query.page) || 1, 1);
  const skip = (page - 1) * limit;
  
  // Cursor-based params
  const cursor = query.cursor || null;
  const direction = query.direction === 'prev' ? 'prev' : 'next';

  return { limit, page, skip, cursor, direction };
};

/**
 * Build cursor-based query conditions
 * 
 * @param {string} cursor - Base64 encoded cursor
 * @param {string} direction - 'next' or 'prev'
 * @param {string} sortField - Field to sort by (default: createdAt)
 * @param {number} sortOrder - 1 for ascending, -1 for descending
 */
const buildCursorQuery = (cursor, direction = 'next', sortField = 'createdAt', sortOrder = -1) => {
  if (!cursor) return {};

  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    const { value, id } = decoded;

    // For descending sort (newest first), 'next' means older items
    const operator = (direction === 'next') === (sortOrder === -1) ? '$lt' : '$gt';

    return {
      $or: [
        { [sortField]: { [operator]: new Date(value) } },
        {
          [sortField]: new Date(value),
          _id: { [operator]: id }
        }
      ]
    };
  } catch (err) {
    console.error('Invalid cursor:', err.message);
    return {};
  }
};

/**
 * Generate cursor from document
 */
const generateCursor = (doc, sortField = 'createdAt') => {
  if (!doc) return null;
  
  const value = doc[sortField] instanceof Date 
    ? doc[sortField].toISOString() 
    : doc[sortField];
    
  return Buffer.from(JSON.stringify({
    value,
    id: doc._id.toString()
  })).toString('base64');
};

/**
 * Build paginated response
 */
const paginatedResponse = (items, { limit, page, cursor, total = null }) => {
  const hasMore = items.length === limit;
  const nextCursor = hasMore && items.length > 0 
    ? generateCursor(items[items.length - 1]) 
    : null;
  const prevCursor = items.length > 0 
    ? generateCursor(items[0]) 
    : null;

  const response = {
    data: items,
    pagination: {
      limit,
      hasMore,
      nextCursor,
      prevCursor
    }
  };

  // Include total and page info for offset pagination
  if (total !== null) {
    response.pagination.total = total;
    response.pagination.page = page;
    response.pagination.totalPages = Math.ceil(total / limit);
  }

  return response;
};

/**
 * Mongoose plugin for adding pagination methods
 */
const paginationPlugin = (schema) => {
  schema.statics.paginate = async function(query, options = {}) {
    const {
      limit = DEFAULT_LIMIT,
      page = 1,
      cursor = null,
      sort = { createdAt: -1 },
      populate = [],
      select = null
    } = options;

    const sortField = Object.keys(sort)[0];
    const sortOrder = sort[sortField];

    // Build query with cursor if provided
    const cursorQuery = cursor 
      ? buildCursorQuery(cursor, 'next', sortField, sortOrder)
      : {};

    const finalQuery = { ...query, ...cursorQuery };

    // Execute query
    let queryBuilder = this.find(finalQuery)
      .sort(sort)
      .limit(limit + 1); // Fetch one extra to check hasMore

    if (select) queryBuilder = queryBuilder.select(select);
    
    for (const pop of populate) {
      queryBuilder = queryBuilder.populate(pop);
    }

    const items = await queryBuilder.exec();
    
    // Check if there are more items
    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    // Get total count for offset pagination (optional, can be expensive)
    let total = null;
    if (!cursor && page) {
      total = await this.countDocuments(query);
    }

    return paginatedResponse(items, { limit, page, cursor, total });
  };
};

module.exports = {
  parsePaginationParams,
  buildCursorQuery,
  generateCursor,
  paginatedResponse,
  paginationPlugin,
  DEFAULT_LIMIT,
  MAX_LIMIT
};
