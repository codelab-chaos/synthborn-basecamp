import { Divider, Flex, Pagination, Typography } from "antd";

type PrefabGalleryToolbarProps = {
  page: number;
  pageSize: number;
  total: number;
  catalogTotal: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function PrefabGalleryToolbar({
  page,
  pageSize,
  total,
  catalogTotal,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: PrefabGalleryToolbarProps) {
  return (
    <>
      <Divider style={{ margin: "16px 0 12px" }} />
      <Flex className="gallery-toolbar" justify="space-between" align="center" wrap="wrap" gap="middle">
        <Typography.Text type="secondary">
          {total
            ? `${total} of ${catalogTotal} matched · page ${page} of ${totalPages}`
            : "No results"}
        </Typography.Text>
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          pageSizeOptions={[10, 20, 50, 100]}
          onChange={onPageChange}
          onShowSizeChange={(_, size) => onPageSizeChange(size)}
          showTotal={(count, range) => `${range[0]}-${range[1]} of ${count}`}
        />
      </Flex>
    </>
  );
}
