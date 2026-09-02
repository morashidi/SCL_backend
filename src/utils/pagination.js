const parsePagination = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);

  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(query.pageSize, 10) || 20)
  );

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  };
};

const paginated = ({ page, pageSize, total, items }) => ({
  page,
  pageSize,
  total,
  items,
});

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = {
  parsePagination,
  paginated,
  escapeRegex,
};
