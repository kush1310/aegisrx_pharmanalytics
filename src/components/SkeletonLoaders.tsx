/**
 * SkeletonLoaders — Inline skeleton components for subsequent data re-fetches.
 *
 * These are used exclusively for search, filter, sort, and pagination triggers
 * AFTER the initial page mount has completed. They do NOT show the branded
 * PageLoader overlay and do NOT blur the page. Each skeleton mirrors the exact
 * visual structure of its corresponding real card/row so the layout shift is
 * imperceptible.
 *
 * Available exports:
 *   - DoctorCardSkeleton     — mirrors Doctor card (SimpleGrid cols={3} equivalent)
 *   - PharmacyCardSkeleton   — mirrors Pharmacy card
 *   - ProductCardSkeleton    — mirrors Product card (denser, 4-col grid)
 *   - NotificationRowSkeleton — mirrors Notification card row
 *   - TableRowSkeleton       — generic table row skeleton (configurable column count)
 *   - DoctorCardSkeletonGrid  — renders N DoctorCardSkeletons in a SimpleGrid
 *   - PharmacyCardSkeletonGrid
 *   - ProductCardSkeletonGrid
 */
import { Skeleton, SimpleGrid, Group, Stack, Card } from '@mantine/core';

// ─── Shared shimmer styles ────────────────────────────────────────────────────
const CARD_STYLE: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '16px',
  background: '#fff'
};

// ─── Doctor Card Skeleton ─────────────────────────────────────────────────────

/**
 * DoctorCardSkeleton — mirrors the DoctorCard layout:
 *   avatar circle + name text + specialization text + contact + address + actions
 */
export function DoctorCardSkeleton() {
  return (
    <div style={CARD_STYLE}>
      <Group wrap="nowrap" gap="md" mb="md">
        {/* Avatar circle */}
        <Skeleton circle height={48} width={48} />
        <Stack gap="xs" style={{ flex: 1 }}>
          {/* Name */}
          <Skeleton height={14} width="65%" radius="md" />
          {/* Specialization */}
          <Skeleton height={11} width="40%" radius="md" />
        </Stack>
      </Group>
      <Stack gap="xs">
        <Group gap="xs">
          <Skeleton circle height={14} width={14} />
          <Skeleton height={11} width="55%" radius="md" />
        </Group>
        <Group gap="xs">
          <Skeleton circle height={14} width={14} />
          <Skeleton height={11} width="75%" radius="md" />
        </Group>
        <Group gap="xs">
          <Skeleton circle height={14} width={14} />
          <Skeleton height={11} width="35%" radius="md" />
        </Group>
      </Stack>
      <Group justify="space-between" mt="md">
        <Skeleton height={20} width={60} radius="xl" />
        <Skeleton circle height={28} width={28} />
      </Group>
    </div>
  );
}

/**
 * DoctorCardSkeletonGrid — renders `count` DoctorCardSkeleton instances
 * in a SimpleGrid that matches the Doctors page grid layout.
 *
 * @param count - Number of skeleton cards to render (default: 6)
 */
export function DoctorCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
      {Array.from({ length: count }).map((_, i) => (
        <DoctorCardSkeleton key={i} />
      ))}
    </SimpleGrid>
  );
}

// ─── Pharmacy Card Skeleton ───────────────────────────────────────────────────

/**
 * PharmacyCardSkeleton — mirrors the PharmacyCard layout:
 *   pill icon + name + owner + contact + address + license + menu button
 */
export function PharmacyCardSkeleton() {
  return (
    <div style={CARD_STYLE}>
      <Group wrap="nowrap" gap="md" mb="md">
        <Skeleton circle height={48} width={48} />
        <Stack gap="xs" style={{ flex: 1 }}>
          <Skeleton height={14} width="60%" radius="md" />
          <Skeleton height={11} width="45%" radius="md" />
        </Stack>
      </Group>
      <Stack gap="xs">
        <Group gap="xs">
          <Skeleton circle height={14} width={14} />
          <Skeleton height={11} width="50%" radius="md" />
        </Group>
        <Group gap="xs">
          <Skeleton circle height={14} width={14} />
          <Skeleton height={11} width="70%" radius="md" />
        </Group>
        <Group gap="xs">
          <Skeleton circle height={14} width={14} />
          <Skeleton height={11} width="40%" radius="md" />
        </Group>
      </Stack>
      <Group justify="flex-end" mt="md">
        <Skeleton circle height={28} width={28} />
      </Group>
    </div>
  );
}

/**
 * PharmacyCardSkeletonGrid — renders `count` PharmacyCardSkeleton instances
 * in a SimpleGrid matching the Pharmacies page grid layout.
 *
 * @param count - Number of skeleton cards to render (default: 6)
 */
export function PharmacyCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
      {Array.from({ length: count }).map((_, i) => (
        <PharmacyCardSkeleton key={i} />
      ))}
    </SimpleGrid>
  );
}

// ─── Product Card Skeleton ────────────────────────────────────────────────────

/**
 * ProductCardSkeleton — mirrors the ProductCard layout:
 *   package icon + name text + pack badge + pharmacy count badge + menu button
 */
export function ProductCardSkeleton() {
  return (
    <div style={{ ...CARD_STYLE, padding: '12px' }}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Skeleton circle height={24} width={24} />
          <Stack gap={4} style={{ flex: 1 }}>
            <Skeleton height={13} width="70%" radius="md" />
            <Skeleton height={18} width={50} radius="xl" />
          </Stack>
        </Group>
        <Skeleton circle height={28} width={28} />
      </Group>
    </div>
  );
}

/**
 * ProductCardSkeletonGrid — renders `count` ProductCardSkeleton instances
 * in a SimpleGrid matching the Products page grid layout (denser, 4-col).
 *
 * @param count - Number of skeleton cards to render (default: 8)
 */
export function ProductCardSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <SimpleGrid cols={{ base: 1, md: 3, xl: 4 }} spacing="md">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </SimpleGrid>
  );
}

// ─── Notification Row Skeleton ────────────────────────────────────────────────

/**
 * NotificationRowSkeleton — mirrors the notification card row layout:
 *   icon circle + title + message + date + action button
 */
export function NotificationRowSkeleton() {
  return (
    <div style={{ ...CARD_STYLE, display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
      <Skeleton circle height={48} width={48} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <Group gap="xs" mb={6}>
          <Skeleton height={13} width="40%" radius="md" />
          <Skeleton height={18} width={55} radius="xl" />
        </Group>
        <Skeleton height={11} width="85%" radius="md" mb={4} />
        <Skeleton height={11} width="60%" radius="md" mb={8} />
        <Skeleton height={10} width="30%" radius="md" />
      </div>
      <Skeleton height={28} width={80} radius="md" style={{ flexShrink: 0 }} />
    </div>
  );
}

/**
 * NotificationSkeletonStack — renders `count` NotificationRowSkeleton instances
 * in a vertical Stack matching the Notifications page layout.
 *
 * @param count - Number of skeleton rows to render (default: 5)
 */
export function NotificationSkeletonStack({ count = 5 }: { count?: number }) {
  return (
    <Stack gap="md">
      {Array.from({ length: count }).map((_, i) => (
        <NotificationRowSkeleton key={i} />
      ))}
    </Stack>
  );
}

// ─── Table Row Skeleton ───────────────────────────────────────────────────────

/**
 * TableRowSkeleton — renders a single skeleton table row with `columnCount` cells.
 * Each cell shows a Skeleton of randomized-feeling widths to avoid monotony.
 *
 * @param columnCount - Number of table columns (default: 5)
 * @param rowIndex    - Used to offset width variation for visual interest
 */
export function TableRowSkeleton({ columnCount = 5, rowIndex = 0 }: { columnCount?: number; rowIndex?: number }) {
  // Pre-defined width patterns to simulate real content variety
  const widthPatterns = [
    ['45%', '20%', '25%', '15%', '10%'],
    ['55%', '25%', '20%', '18%', '12%'],
    ['40%', '22%', '28%', '16%', '14%'],
    ['60%', '18%', '22%', '20%', '11%'],
    ['50%', '28%', '24%', '14%', '13%'],
  ];
  const patternIndex = rowIndex % widthPatterns.length;
  const widths = widthPatterns[patternIndex];

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      {Array.from({ length: columnCount }).map((_, colIdx) => (
        <td key={colIdx} style={{ padding: '12px 8px' }}>
          <Skeleton height={12} width={widths[colIdx] ?? '50%'} radius="md" />
        </td>
      ))}
    </tr>
  );
}

/**
 * TableSkeletonBody — renders `rowCount` TableRowSkeleton instances inside a tbody.
 * Drop this directly inside a Mantine Table or native table element.
 *
 * @param rowCount    - Number of skeleton rows (default: 8)
 * @param columnCount - Number of columns per row (default: 5)
 */
export function TableSkeletonBody({ rowCount = 8, columnCount = 5 }: { rowCount?: number; columnCount?: number }) {
  return (
    <tbody>
      {Array.from({ length: rowCount }).map((_, i) => (
        <TableRowSkeleton key={i} columnCount={columnCount} rowIndex={i} />
      ))}
    </tbody>
  );
}

// ─── Dashboard Stat Card Skeleton ─────────────────────────────────────────────

/**
 * StatCardSkeleton — mirrors the Dashboard KPI stat card layout:
 *   label + big number + sub-label on left; icon square on right.
 */
export function StatCardSkeleton() {
  return (
    <Card
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: '100px'
      }}
    >
      <Stack gap="xs">
        <Skeleton height={10} width={90} radius="md" />
        <Skeleton height={32} width={60} radius="md" />
        <Skeleton height={10} width={70} radius="md" />
      </Stack>
      <Skeleton height={56} width={56} radius="md" />
    </Card>
  );
}

/**
 * StatCardSkeletonGrid — renders 3 StatCardSkeleton instances in a row,
 * matching the Dashboard KPI grid layout.
 */
export function StatCardSkeletonGrid() {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 3 }} spacing="md" mb="xl">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </SimpleGrid>
  );
}

// ─── Doctor Profile Skeleton ───────────────────────────────────────────────────

/**
 * DoctorProfileSkeleton — mirrors the full DoctorProfile page layout:
 *   1. Header card: avatar circle + name + specialization + badge row + action buttons
 *   2. Divider
 *   3. Info grid: 6 rows of icon + label + value
 *   4. Tabs row: two tab placeholders
 *   5. Table skeleton: 4 rows of pharmacy data placeholders
 *
 * Shown while the doctor record is being fetched from the API. Replaces both
 * the PageLoader spinner and the blur-overlay pattern for a smoother transition.
 */
export function DoctorProfileSkeleton() {
  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* ── Header Card ─────────────────────────────────────── */}
      <Card
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '24px',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}
      >
        {/* Top row: avatar + name area + action buttons */}
        <Group justify="space-between" align="flex-start">
          <Group gap="lg">
            {/* Doctor avatar circle */}
            <Skeleton circle height={64} width={64} />
            <Stack gap="xs">
              {/* Name */}
              <Skeleton height={22} width={220} radius="md" />
              {/* Specialization */}
              <Skeleton height={13} width={140} radius="md" />
              {/* Badge row: qualification + experience */}
              <Group gap="xs" mt={4}>
                <Skeleton height={22} width={80} radius="xl" />
                <Skeleton height={22} width={90} radius="xl" />
              </Group>
            </Stack>
          </Group>
          {/* Action buttons: Edit + Export PDF + Delete */}
          <Group gap="sm">
            <Skeleton height={34} width={72} radius="md" />
            <Skeleton height={34} width={110} radius="md" />
            <Skeleton circle height={34} width={34} />
          </Group>
        </Group>

        {/* Divider */}
        <div style={{ height: 1, background: '#f1f5f9', margin: '20px 0' }} />

        {/* Info grid — 3 columns × 2 rows of icon + label + value */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px 32px',
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Group key={i} gap="sm" wrap="nowrap" align="flex-start">
              {/* Icon placeholder */}
              <Skeleton circle height={16} width={16} style={{ marginTop: 4, flexShrink: 0 }} />
              <Stack gap={5} style={{ flex: 1 }}>
                {/* Label */}
                <Skeleton height={10} width="45%" radius="md" />
                {/* Value */}
                <Skeleton height={14} width={i % 2 === 0 ? '75%' : '60%'} radius="md" />
              </Stack>
            </Group>
          ))}
        </div>
      </Card>

      {/* ── Tabs Area ───────────────────────────────────────── */}
      <div style={{ marginTop: 20 }}>
        {/* Tab headers */}
        <Group gap="md" style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: 4, marginBottom: 16 }}>
          <Skeleton height={32} width={160} radius="md" />
          <Skeleton height={32} width={180} radius="md" />
        </Group>

        {/* Tab content — linked pharmacies table placeholder */}
        <Card
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px',
            background: '#fff',
          }}
        >
          {/* Add pharmacy button row */}
          <Group justify="flex-end" mb="md">
            <Skeleton height={34} width={140} radius="md" />
          </Group>

          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 1fr 1fr',
              gap: 8,
              padding: '8px 12px',
              background: '#f8fafc',
              borderRadius: '8px',
              marginBottom: 8,
            }}
          >
            {['55%', '45%', '50%', '35%'].map((w, i) => (
              <Skeleton key={i} height={11} width={w} radius="md" />
            ))}
          </div>

          {/* Table rows */}
          {Array.from({ length: 4 }).map((_, rowIdx) => (
            <div
              key={rowIdx}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 1fr 1fr',
                gap: 8,
                padding: '10px 12px',
                borderBottom: '1px solid #f8fafc',
              }}
            >
              {['70%', '55%', '45%', '30%'].map((w, colIdx) => (
                <Skeleton key={colIdx} height={12} width={w} radius="md" />
              ))}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
// ─── Pharmacy Profile Skeleton ─────────────────────────────────────────────────

/**
 * PharmacyProfileSkeleton — mirrors the full PharmacyProfile page layout:
 *   1. Header card: pill avatar + name + owner row + delete button
 *   2. Detail stack: contact, address, license rows
 *   3. Tabs row: one tab placeholder
 *   4. Products list: 3 product row placeholders
 *
 * Shown while the pharmacy record is being fetched from the API.
 * Replaces the PageLoader spinner and blur-overlay pattern.
 */
export function PharmacyProfileSkeleton() {
  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* ── Header Card ─────────────────────────────────────── */}
      <Card
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '24px',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Top row: avatar + name/owner + delete button */}
        <Group justify="space-between" align="flex-start">
          <Group gap="lg">
            <Skeleton circle height={64} width={64} />
            <Stack gap="xs">
              {/* Pharmacy name */}
              <Skeleton height={24} width={240} radius="md" />
              {/* Owner row */}
              <Group gap="xs">
                <Skeleton circle height={14} width={14} />
                <Skeleton height={13} width={160} radius="md" />
              </Group>
            </Stack>
          </Group>
          {/* Delete button */}
          <Skeleton circle height={36} width={36} />
        </Group>

        {/* Detail rows: contact, address, license */}
        <Stack gap="sm" mt="xl">
          {[180, 280, 140].map((w, i) => (
            <Group key={i} gap="sm">
              <Skeleton circle height={18} width={18} />
              <Skeleton height={14} width={w} radius="md" />
            </Group>
          ))}
          {/* Optional: GST + drug license text lines */}
          <Skeleton height={12} width={120} radius="md" ml={26} />
          <Skeleton height={12} width={150} radius="md" ml={26} />
        </Stack>
      </Card>

      {/* ── Tabs Row ────────────────────────────────────────── */}
      <div style={{ marginTop: 24 }}>
        <Group gap="md" style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: 4, marginBottom: 16 }}>
          <Skeleton height={32} width={160} radius="md" />
        </Group>

        {/* Product rows */}
        <Stack gap="md">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card
              key={i}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 16px',
                background: '#fff',
              }}
            >
              <Group gap="sm">
                <Skeleton circle height={40} width={40} />
                <Skeleton height={15} width={i % 2 === 0 ? 200 : 160} radius="md" />
              </Group>
            </Card>
          ))}
        </Stack>
      </div>
    </div>
  );
}
