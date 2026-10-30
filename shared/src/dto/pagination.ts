export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
};

export type Paginated<T> = {
  data: T[];
  meta: PageMeta;
};

export type DataResponse<T> = {
  data: T;
};
