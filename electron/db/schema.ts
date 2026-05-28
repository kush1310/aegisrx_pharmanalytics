import { sqliteTable, text, integer, blob, unique, index, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ── Users ──────────────────────────────────────────────────────────
export const users = sqliteTable('User', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  username:     text('username').notNull().unique(), // kept for compatibility but login is email-based
  prefix:       text('prefix').notNull().default('Mr.'),
  firstName:    text('firstName').notNull().default(''),
  lastName:     text('lastName').notNull().default(''),
  birthDate:    text('birthDate'),
  email:        text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  role:         text('role').notNull().default('ADMIN'),
  createdAt:    text('createdAt').notNull().default(sql`(datetime('now'))`),
  updatedAt:    text('updatedAt').notNull().default(sql`(datetime('now'))`),
});

// ── Doctors ────────────────────────────────────────────────────────
export const doctors = sqliteTable('Doctor', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  name:           text('name').notNull(),
  contact:        text('contact').notNull(),
  address:        text('address').notNull(),
  birthDate:      text('birthDate'),
  isMarried:      integer('isMarried', { mode: 'boolean' }).notNull().default(false),
  spouseName:     text('spouseName'),
  anniversary:    text('anniversary'),
  childrenCount:  integer('childrenCount').notNull().default(0),
  childrenNames:  text('childrenNames'),
  qualification:  text('qualification').notNull(),
  specialization: text('specialization').notNull(),
  email:          text('email'),
  registrationNo: text('registrationNo'),
  experienceYrs:  integer('experienceYrs'),
  createdAt:      text('createdAt').notNull().default(sql`(datetime('now'))`),
  updatedAt:      text('updatedAt').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  nameIdx: index('doctor_name_idx').on(t.name),
  contactIdx: index('doctor_contact_idx').on(t.contact),
  createdIdx: index('doctor_created_idx').on(t.createdAt),
}));

// ── Pharmacies ─────────────────────────────────────────────────────
export const pharmacies = sqliteTable('Pharmacy', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  name:           text('name').notNull(),
  ownerName:      text('ownerName').notNull(),
  licenseId:      text('licenseId').notNull().unique(),
  gstNumber:      text('gstNumber'),
  drugLicense:    text('drugLicense'),
  address:        text('address').notNull(),
  contact:        text('contact').notNull(),
  ownerBirthDate: text('ownerBirthDate'),
  doctorId:       integer('doctorId').references(() => doctors.id, { onDelete: 'set null' }),
  isDraft:        integer('isDraft', { mode: 'boolean' }).notNull().default(false),
  createdAt:      text('createdAt').notNull().default(sql`(datetime('now'))`),
  updatedAt:      text('updatedAt').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  nameIdx: index('pharmacy_name_idx').on(t.name),
  licenseIdx: index('pharmacy_license_idx').on(t.licenseId),
  createdIdx: index('pharmacy_created_idx').on(t.createdAt),
}));

// ── Products ───────────────────────────────────────────────────────
export const products = sqliteTable('Product', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  name:      text('name').notNull(),
  pack:      text('pack'), // Stores pack size, e.g. "1x10"
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updatedAt').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  nameIdx: index('product_name_idx').on(t.name),
  uniqNamePack: unique().on(t.name, t.pack),
  createdIdx: index('product_created_idx').on(t.createdAt),
}));

// ── DoctorProduct ─────────────────────────────────────────────────
// Explicitly tracks which medicines (products) a doctor prescribes.
// Populated manually via the Doctor Profile UI — not inferred from transactions.
export const doctorProducts = sqliteTable('DoctorProduct', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  doctorId:  integer('doctorId').notNull().references(() => doctors.id, { onDelete: 'cascade' }),
  productId: integer('productId').notNull().references(() => products.id, { onDelete: 'cascade' }),
  createdAt: text('createdAt').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  uniq:      unique().on(t.doctorId, t.productId),
  doctorIdx: index('dp_doctor_idx').on(t.doctorId),
  prodIdx:   index('dp_product_idx').on(t.productId),
}));

// ── PharmacyProduct ────────────────────────────────────────────────
export const pharmacyProducts = sqliteTable('PharmacyProduct', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  pharmacyId: integer('pharmacyId').notNull().references(() => pharmacies.id, { onDelete: 'cascade' }),
  productId:  integer('productId').notNull().references(() => products.id, { onDelete: 'cascade' }),
  createdAt:  text('createdAt').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  uniq: unique().on(t.pharmacyId, t.productId),
  pharmacyIdx: index('pp_pharmacy_idx').on(t.pharmacyId),
  productIdx: index('pp_product_idx').on(t.productId),
}));



// ── SalesTransactions ────────────────────────────────────────────────
export const salesTransactions = sqliteTable('SalesTransaction', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  pharmacyId: integer('pharmacyId').notNull().references(() => pharmacies.id, { onDelete: 'cascade' }),
  productId:  integer('productId').notNull().references(() => products.id, { onDelete: 'cascade' }),
  amount:     real('amount').notNull().default(0), // Can store as integer or real depending on need. Using integer for consistency or Real if needed. We'll use real for currency.
  saleQty:    integer('saleQty').notNull().default(0),
  freeQty:    integer('freeQty').notNull().default(0),
  freeAmt:    real('freeAmt').notNull().default(0),
  date:       text('date').notNull(),
  uploadId:   integer('uploadId').references(() => excelUploads.id, { onDelete: 'set null' }),
  createdAt:  text('createdAt').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  pharmacyIdx: index('sales_pharmacy_idx').on(t.pharmacyId),
  productIdx: index('sales_product_idx').on(t.productId),
  dateIdx: index('sales_date_idx').on(t.date),
}));

// ── ExcelUploads ────────────────────────────────────────────────────
export const excelUploads = sqliteTable('ExcelUpload', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  fileName:   text('fileName').notNull(),
  fileHash:   text('fileHash').notNull().unique(),
  fileSize:   integer('fileSize').notNull(),
  fileData:   blob('fileData', { mode: 'buffer' }).notNull(),
  uploadDate: text('uploadDate').notNull().default(sql`(datetime('now'))`),
  status:     text('status').notNull().default('PROCESSED'),
});

// ── Notifications ──────────────────────────────────────────────────
export const notifications = sqliteTable('Notification', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  entityType: text('entityType').notNull(),
  entityId:   integer('entityId').notNull(),
  eventType:  text('eventType').notNull(),
  eventDate:  text('eventDate').notNull(),
  title:      text('title').notNull(),
  message:    text('message').notNull(),
  isRead:     integer('isRead', { mode: 'boolean' }).notNull().default(false),
  createdAt:  text('createdAt').notNull().default(sql`(datetime('now'))`),
});

// ── TypeScript inference helpers ───────────────────────────────────
export type User            = typeof users.$inferSelect;
export type NewUser         = typeof users.$inferInsert;
export type Doctor          = typeof doctors.$inferSelect;
export type NewDoctor       = typeof doctors.$inferInsert;
export type Pharmacy        = typeof pharmacies.$inferSelect;
export type NewPharmacy     = typeof pharmacies.$inferInsert;
export type Product         = typeof products.$inferSelect;
export type NewProduct      = typeof products.$inferInsert;
export type PharmacyProduct  = typeof pharmacyProducts.$inferSelect;
export type DoctorProduct    = typeof doctorProducts.$inferSelect;
export type NewDoctorProduct = typeof doctorProducts.$inferInsert;
export type ExcelUpload      = typeof excelUploads.$inferSelect;
export type Notification     = typeof notifications.$inferSelect;
export type SalesTransaction = typeof salesTransactions.$inferSelect;
export type NewSalesTransaction = typeof salesTransactions.$inferInsert;
