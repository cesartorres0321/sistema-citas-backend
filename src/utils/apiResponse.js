export const ok = (res, data, statusCode = 200) =>
  res.status(statusCode).json({ success: true, data });

export const created = (res, data) =>
  res.status(201).json({ success: true, data });

export const paginated = (res, data, total, page, totalPages) =>
  res.status(200).json({ success: true, data, meta: { total, page, totalPages } });

export const err = (res, error, statusCode = 400) =>
  res.status(statusCode).json({ success: false, error });
