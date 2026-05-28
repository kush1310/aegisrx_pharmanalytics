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
import {
  Text,
  Button,
  SimpleGrid,
  Card,
  Group,
  Stack,
  Skeleton,
  TextInput,
  Modal,
  Menu,
  ActionIcon,
  Badge
} from '@mantine/core';
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
  IconSearch,
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
    isLoadingProducts,
    fetchProducts,
    productTotal,
    productPage,
    productTotalPages,
  } = useAppStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productName, setProductName] = useState('');
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [sortField, setSortField] = useState<'name' | 'pharmacyCount' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load & when sort changes
  useEffect(() => {
    fetchProducts(1, PRODUCTS_PER_PAGE, localSearch.trim(), sortField, sortDir);
  }, [fetchProducts, sortField, sortDir]);

  // Debounced search — 300ms delay to avoid excessive API calls
  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchProducts(1, PRODUCTS_PER_PAGE, value.trim(), sortField, sortDir);
    }, 300);
  }, [fetchProducts, sortField, sortDir]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    fetchProducts(newPage, PRODUCTS_PER_PAGE, localSearch.trim(), sortField, sortDir);
  }, [fetchProducts, localSearch, sortField, sortDir]);

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
    setModalOpen(true);
  };

  /**
   * openEditModal — Opens the modal in "edit" mode with the product's data.
   */
  const openEditModal = (id: number, name: string) => {
    setEditingProductId(id);
    setProductName(name);
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
        result = await api.put(`/api/products/${editingProductId}`, { name: productName.trim() });
      } else {
        result = await api.post('/api/products', { name: productName.trim() });
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

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
    try {
      const result = await api.delete(`/api/products/${id}`);
      if (result.success) {
        notifications.show({ title: 'Product Deleted', message: `${name} has been removed.`, color: 'green' });
        fetchProducts(productPage, PRODUCTS_PER_PAGE, localSearch.trim(), sortField, sortDir);
      }
    } catch (err) {
      notifications.show({ title: 'Delete Failed', message: 'Could not delete product. It may be linked to a pharmacy.', color: 'red' });
    }
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

      {/* Server-side search & Sort */}
      <Group gap="sm" mb="lg" align="flex-end">
        <TextInput
          className={styles.searchBar}
          placeholder="Search products..."
          leftSection={<IconSearch size={18} />}
          value={localSearch}
          onChange={(e) => handleSearchChange(e.currentTarget.value)}
          size="md"
          radius="md"
          style={{ flex: 1, marginBottom: 0 }}
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

      {isLoadingProducts ? (
        <SimpleGrid cols={{ base: 1, md: 3, xl: 4 }} spacing="md">
          {[...Array(8)].map((_, i) => (
            <Card key={i} shadow="sm" radius="lg" p="lg"><Skeleton height={20} width="60%" /></Card>
          ))}
        </SimpleGrid>
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
                  className={styles.productCard}
                  shadow="sm"
                  radius="lg"
                  p="md"
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                      <IconPackage size={24} color="var(--color-primary)" />
                      <div style={{ minWidth: 0 }}>
                        <Text fw={800} lineClamp={1} title={product.name}>{product.name}</Text>
                        {pharmacyCount > 0 && (
                          <Badge size="xs" variant="light" color="blue" mt={4}>
                            {pharmacyCount} {pharmacyCount === 1 ? 'pharmacy' : 'pharmacies'}
                          </Badge>
                        )}
                      </div>
                    </Group>
                    <Menu position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray"><IconDotsVertical size={18} /></ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => openEditModal(product.id, product.name)}>Edit</Menu.Item>
                        <Menu.Item leftSection={<IconTrash size={16} />} color="red" onClick={() => handleDelete(product.id, product.name)}>Delete</Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
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

      {/* Add / Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => { setModalOpen(false); setEditingProductId(null); setProductName(''); }}
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
          <Button color="indigo" onClick={handleSaveProduct} loading={saving}>
            {editingProductId ? 'Update Product' : 'Save Product'}
          </Button>
        </Stack>
      </Modal>
    </div>
  );
}
