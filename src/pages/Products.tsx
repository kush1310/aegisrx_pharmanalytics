/**
 * Products — Optimized listing with server-side pagination & search
 *
 * Lists every product stored in the database with card-based layout.
 * Provides inline edit via modal, single add, and bulk Excel upload.
 * Server-side search with SQL LIKE replaces client-side Fuse.js.
 * CSS-only animations replace framer-motion for instant rendering.
 *
 * Performance target: < 2s full load with 10k+ products.
 *
 * @returns {JSX.Element} Responsive products grid page.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { modals } from '@mantine/modals';
import {
  Text,
  Button,
  SimpleGrid,
  Card,
  Group,
  Stack,
  TextInput,
  Modal,
  Menu,
  ActionIcon,
  Badge,
  Table,
  Loader,
  Anchor
} from '@mantine/core';
import { ProductCardSkeletonGrid } from '../components/SkeletonLoaders';
import PageSearchBar from '../components/PageSearchBar';
import type { SearchSuggestion } from '../components/PageSearchBar';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconBox,
  IconPackage,
  IconTrash,
  IconUpload,
  IconDotsVertical,
  IconEdit,
  IconDownload,
  IconChevronLeft,
  IconChevronRight,
  IconSortAscending,
  IconSortDescending
} from '@tabler/icons-react';
import { useAppStore } from '../stores/appStore';
import { exportProductListPDF, exportToCSV } from '@/utils/export';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import styles from './Products.module.css';

const PRODUCTS_PER_PAGE = 100;

export default function Products() {
  const {
    products,
    fetchProducts,
    productTotal,
    productPage,
    productTotalPages,
    isLoadingProducts,
  } = useAppStore();

  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productName, setProductName] = useState('');
  const [productPack, setProductPack] = useState('');
  
  // Details modal states
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [productDetails, setProductDetails] = useState<any>(null);

  const openDetailsModal = async (productId: number) => {
    setDetailsModalOpen(true);
    setLoadingDetails(true);
    try {
      const res = await api.get(`/api/products/${productId}/details`);
      if (res.success && res.data) {
        setProductDetails(res.data);
      } else {
        throw new Error(res.error || 'Failed to load details');
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Could not fetch product details',
        color: 'red'
      });
      setDetailsModalOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  };
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [sortField, setSortField] = useState<'name' | 'pharmacyCount' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  /**
   * isInitialLoading — true on page mount.
   * Enforces a static 2.5-second skeleton loading.
   */
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searchParams] = useSearchParams();

  /**
   * loadProductsData — unified fetch helper that triggers fetches and manages skeletons.
   */
  const loadProductsData = useCallback(async (
    page: number,
    size: number,
    search: string,
    field: typeof sortField,
    dir: typeof sortDir
  ) => {
    await fetchProducts(page, size, search, field, dir);
  }, [fetchProducts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Fetch matching products from the database for the PageSearchBar dropdown.
   * Debounced to 150ms for instantaneous feeling.
   */
  useEffect(() => {
    if (!localSearch.trim()) {
      setSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await api.get<any>(`/api/search?q=${encodeURIComponent(localSearch)}`);
        if (res.success && res.data && res.data.products) {
          const matched = res.data.products.map((p: any) => ({
            id: p.id,
            primaryText: p.name,
            secondaryText: p.pack ? `Pack: ${p.pack}` : undefined,
            icon: <IconPackage size={16} color="#8b5cf6" />,
          }));
          setSuggestions(matched);
        }
      } catch (err) {
        console.error('Fetch products suggestions error:', err);
      }
    }, 150);
    return () => clearTimeout(delayDebounce);
  }, [localSearch]);

  // Initial load & when sort changes
  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q) {
      setLocalSearch(q);
      loadProductsData(1, PRODUCTS_PER_PAGE, q.trim(), sortField, sortDir);
    } else {
      loadProductsData(1, PRODUCTS_PER_PAGE, localSearch.trim(), sortField, sortDir);
    }
  }, [loadProductsData, sortField, sortDir, searchParams]);

  // Debounced search — 300ms delay to avoid excessive API calls
  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadProductsData(1, PRODUCTS_PER_PAGE, value.trim(), sortField, sortDir);
    }, 300);
  }, [loadProductsData, sortField, sortDir]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    loadProductsData(newPage, PRODUCTS_PER_PAGE, localSearch.trim(), sortField, sortDir);
  }, [loadProductsData, localSearch, sortField, sortDir]);

  const toggleSort = (field: 'name' | 'pharmacyCount' | 'createdAt') => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  /**
   * openAddModal — Resets form state and opens the product modal in "add" mode.
   */
  const openAddModal = () => {
    setEditingProductId(null);
    setProductName('');
    setProductPack('');
    setModalOpen(true);
  };

  /**
   * openEditModal — Opens the modal in "edit" mode with the product's data.
   */
  const openEditModal = (id: number, name: string, pack?: string | null) => {
    setEditingProductId(id);
    setProductName(name);
    setProductPack(pack || '');
    setModalOpen(true);
  };

  /**
   * handleSaveProduct — Validates and calls create or update API.
   */
  const handleSaveProduct = async () => {
    if (!productName.trim()) {
      return notifications.show({ title: 'Validation Error', message: 'Product name is required.', color: 'red' });
    }

    setSaving(true);
    try {
      let result;
      if (editingProductId) {
        result = await api.put(`/api/products/${editingProductId}`, {
          name: productName.trim(),
          pack: productPack.trim() || null
        });
      } else {
        result = await api.post('/api/products', {
          name: productName.trim(),
          pack: productPack.trim() || null
        });
      }

      if (result.success) {
        notifications.show({
          title: editingProductId ? 'Product Updated' : 'Product Added',
          message: `${productName.trim()} has been ${editingProductId ? 'updated' : 'added'} successfully.`,
          color: 'green'
        });
        setModalOpen(false);
        setProductName('');
        setEditingProductId(null);
        fetchProducts(productPage, PRODUCTS_PER_PAGE, localSearch.trim(), sortField, sortDir);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      notifications.show({
        title: 'Save Failed',
        message: err.message || 'An unknown error occurred while saving the product.',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number, name: string) => {
    modals.openConfirmModal({
      title: 'Delete Product',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete "{name}"? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const result = await api.delete(`/api/products/${id}`);
          if (result.success) {
            notifications.show({ title: 'Product Deleted', message: `${name} has been removed.`, color: 'green' });
            fetchProducts(productPage, PRODUCTS_PER_PAGE, localSearch.trim(), sortField, sortDir);
          }
        } catch (err) {
          notifications.show({ title: 'Delete Failed', message: 'Could not delete product. It may be linked to a pharmacy.', color: 'red' });
        }
      }
    });
  };

  // Range display for pagination
  const rangeStart = (productPage - 1) * PRODUCTS_PER_PAGE + 1;
  const rangeEnd = Math.min(productPage * PRODUCTS_PER_PAGE, productTotal);

  return (
    <div className={styles.container}>
      <PageHeader 
        title="Products Inventory"
        subtitle={`${productTotal} product${productTotal !== 1 ? 's' : ''} total`}
        onRefresh={() => fetchProducts(productPage, PRODUCTS_PER_PAGE, localSearch.trim(), sortField, sortDir)}
        refreshing={isLoadingProducts}
        action={
          <Group>
            <Button
              variant="light" color="indigo"
              leftSection={<IconDownload size={18} />}
              onClick={() => {
                const exportData = products.map(p => ({
                  name: p.name,
                  pharmacyCount: (p as any).pharmacyCount || 0
                }));
                exportProductListPDF(exportData);
              }}
            >
              Export PDF
            </Button>
            <Button
              variant="light" color="teal"
              leftSection={<IconDownload size={18} />}
              onClick={() => {
                const csvData = products.map(p => ({
                  'Product Name': p.name,
                  'Pharmacies': (p as any).pharmacyCount || 0,
                  'Created': new Date(p.createdAt).toLocaleDateString('en-IN')
                }));
                exportToCSV(csvData, `products_${new Date().toISOString().split('T')[0]}`, ['Product Name', 'Pharmacies', 'Created']);
              }}
            >
              Export CSV
            </Button>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              id="bulk-product-upload"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  try {
                    const path = (file as any).path;
                    if (path) {
                      const res = await api.post('/api/products/bulk', { path: path });
                      if (res.success) {
                        notifications.show({ title: 'Bulk Upload Complete', message: `${(res.data as any)?.added || 0} new products imported.`, color: 'green' });
                        fetchProducts(1, PRODUCTS_PER_PAGE, localSearch.trim(), sortField, sortDir);
                      } else { throw new Error(res.error); }
                    }
                  } catch (error: any) {
                    notifications.show({ title: 'Upload Failed', message: error.message || 'Could not process the file.', color: 'red' });
                  }
                }
              }}
            />
            <Button
              variant="light" color="blue" leftSection={<IconUpload size={18} />}
              onClick={() => document.getElementById('bulk-product-upload')?.click()}
            >
              Bulk Upload
            </Button>
            <Button
              color="green" leftSection={<IconPlus size={18} />}
              onClick={openAddModal}
            >
              Add Product
            </Button>
          </Group>
        }
      />

      <div className="relative mt-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div>

      {/* Server-side search & Sort */}
      <Group gap="sm" mb="lg" align="flex-end">
        <PageSearchBar
          placeholder="Search products..."
          value={localSearch}
          onChange={handleSearchChange}
          suggestions={suggestions}
          sectionLabel="PRODUCTS"
          onSuggestionClick={(s) => handleSearchChange(s.primaryText)}
          className="flex-1"
        />
        <Menu shadow="md" position="bottom-end" width={200}>
          <Menu.Target>
            <Button
              variant="light"
              color="gray"
              leftSection={sortDir === 'asc' ? <IconSortAscending size={18} /> : <IconSortDescending size={18} />}
              size="md"
              radius="md"
            >
              Sort
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Sort By</Menu.Label>
            <Menu.Item 
              onClick={() => toggleSort('name')}
              rightSection={sortField === 'name' ? (sortDir === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />) : null}
            >
              Product Name
            </Menu.Item>
            <Menu.Item 
              onClick={() => toggleSort('pharmacyCount')}
              rightSection={sortField === 'pharmacyCount' ? (sortDir === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />) : null}
            >
              Linked Pharmacies
            </Menu.Item>
            <Menu.Item 
              onClick={() => toggleSort('createdAt')}
              rightSection={sortField === 'createdAt' ? (sortDir === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />) : null}
            >
              Date Added
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {/* Initial load or subsequent load: skeleton inline, no blur */}
      {(isInitialLoading || isLoadingProducts) ? (
        <ProductCardSkeletonGrid count={12} />
      ) : products.length === 0 ? (
        <Card shadow="sm" radius="lg" p="xl" className={styles.emptyState}>
          <Stack align="center" gap="md">
            <IconBox size={64} stroke={1} color="var(--color-text-muted)" />
            <Text size="lg" fw={800}>No products found</Text>
            {localSearch && (
              <Text size="sm" c="dimmed">Try a different search term</Text>
            )}
          </Stack>
        </Card>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, md: 3, xl: 4 }} spacing="md">
            {products.map((product) => {
              const pharmacyCount = (product as any).pharmacyCount ?? 0;
              return (
                <Card
                  key={product.id}
                  className={`${styles.productCard} cursor-pointer hover:border-pl-indigo hover:shadow-md transition-all duration-200`}
                  shadow="sm"
                  radius="lg"
                  p="md"
                  onClick={() => openDetailsModal(product.id)}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                      <IconPackage size={24} color="var(--color-primary)" />
                      <div style={{ minWidth: 0, width: '100%' }}>
                        <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                          <Text fw={800} className="leading-tight break-words text-pl-navy" style={{ flex: 1 }}>{product.name}</Text>
                          {product.pack && (
                            <Badge size="xs" color="gray" variant="outline" style={{ flexShrink: 0 }}>{product.pack}</Badge>
                          )}
                        </Group>
                        {pharmacyCount > 0 && (
                          <Badge size="xs" variant="light" color="blue" mt={4}>
                            {pharmacyCount} {pharmacyCount === 1 ? 'pharmacy' : 'pharmacies'}
                          </Badge>
                        )}
                      </div>
                    </Group>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Menu position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray"><IconDotsVertical size={18} /></ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => openEditModal(product.id, product.name, product.pack)}>Edit</Menu.Item>
                          <Menu.Item leftSection={<IconTrash size={16} />} color="red" onClick={() => handleDelete(product.id, product.name)}>Delete</Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </div>
                  </Group>
                </Card>
              );
            })}
          </SimpleGrid>

          {/* Pagination */}
          {productTotalPages > 1 && (
            <div className={styles.pagination}>
              <Button
                variant="light"
                size="sm"
                leftSection={<IconChevronLeft size={16} />}
                disabled={productPage <= 1}
                onClick={() => handlePageChange(productPage - 1)}
              >
                Previous
              </Button>
              <Text className={styles.paginationInfo}>
                {rangeStart}–{rangeEnd} of {productTotal}
              </Text>
              <Button
                variant="light"
                size="sm"
                rightSection={<IconChevronRight size={16} />}
                disabled={productPage >= productTotalPages}
                onClick={() => handlePageChange(productPage + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => { setModalOpen(false); setEditingProductId(null); setProductName(''); setProductPack(''); }}
        title={editingProductId ? 'Edit Product' : 'Add New Product'}
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Product Name"
            placeholder="E.g. Paracetamol 500mg"
            required
            value={productName}
            onChange={(e) => setProductName(e.currentTarget.value)}
          />
          <TextInput
            label="Pack Size"
            placeholder="E.g. 1x10 or 10 tablets"
            value={productPack}
            onChange={(e) => setProductPack(e.currentTarget.value)}
          />
          <Button color="indigo" onClick={handleSaveProduct} loading={saving}>
            {editingProductId ? 'Update Product' : 'Save Product'}
          </Button>
        </Stack>
      </Modal>

      {/* Product Details Modal */}
      <Modal
        opened={detailsModalOpen}
        onClose={() => { setDetailsModalOpen(false); setProductDetails(null); }}
        title="Product Details"
        size="lg"
        centered
      >
        {loadingDetails ? (
          <Group justify="center" p="xl">
            <Loader color="indigo" size="md" />
            <Text c="dimmed">Fetching stocking pharmacies...</Text>
          </Group>
        ) : productDetails ? (
          <Stack gap="md">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-2">
              <Group justify="space-between">
                <Stack gap="xs">
                  <Text size="sm" c="dimmed" className="uppercase tracking-wider font-semibold text-xs">Product Name</Text>
                  <Text size="lg" fw={800} className="text-pl-navy leading-tight">{productDetails.name}</Text>
                </Stack>
                {productDetails.pack && (
                  <Stack gap="xs" align="flex-end">
                    <Text size="sm" c="dimmed" className="uppercase tracking-wider font-semibold text-xs">Pack Size</Text>
                    <Badge color="gray" size="md" variant="outline">{productDetails.pack}</Badge>
                  </Stack>
                )}
              </Group>
            </div>

            <Text fw={700} size="sm" className="text-pl-navy mb-1">Stocking Pharmacies ({productDetails.pharmacies?.length || 0})</Text>

            {productDetails.pharmacies && productDetails.pharmacies.length > 0 ? (
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <Table highlightOnHover className="min-w-full">
                  <Table.Thead className="bg-slate-50">
                    <Table.Tr>
                      <Table.Th className="text-xs font-semibold text-slate-500">Pharmacy Name</Table.Th>
                      <Table.Th className="text-xs font-semibold text-slate-500">License ID</Table.Th>
                      <Table.Th className="text-xs font-semibold text-slate-500">Contact</Table.Th>
                      <Table.Th className="text-right text-xs font-semibold text-slate-500">Sales Qty</Table.Th>
                      <Table.Th className="text-right text-xs font-semibold text-slate-500">Sales Value</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {productDetails.pharmacies.map((pharmacy: any) => (
                      <Table.Tr key={pharmacy.id}>
                        <Table.Td>
                          <Anchor 
                            fw={700} 
                            color="indigo" 
                            size="sm"
                            onClick={() => {
                              setDetailsModalOpen(false);
                              navigate(`/pharmacies/${pharmacy.id}`);
                            }}
                            className="hover:underline cursor-pointer"
                          >
                            {pharmacy.name}
                          </Anchor>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">{pharmacy.licenseId}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">{pharmacy.contact}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={600} className="text-slate-700">{pharmacy.totalQty || 0}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={700} className="text-emerald-600">₹{(pharmacy.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Text c="dimmed" size="sm">No pharmacies are currently stocking this product.</Text>
              </div>
            )}
          </Stack>
        ) : null}
      </Modal>
    </div>
  );
}
