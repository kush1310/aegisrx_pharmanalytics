// Type definitions for SuratPharma Analytics

export interface Doctor {
  id: number;
  name: string;
  contact: string;
  address: string;
  birthDate: string | null;
  isMarried: boolean;
  spouseName: string | null;
  anniversary: string | null;
  childrenCount: number;
  childrenNames: string | null;
  qualification: string;
  specialization: string;
  registrationNo?: string | null;
  email?: string | null;
  experienceYrs?: number | null;
  createdAt: string;
  updatedAt: string;
  pharmacies?: Pharmacy[];
  salesRecords?: SalesRecord[];
}

export interface Product {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  pharmacies?: PharmacyProduct[];
}

export interface Pharmacy {
  id: number;
  name: string;
  ownerName: string;
  licenseId: string;
  gstNumber: string | null;
  drugLicense: string | null;
  address: string;
  contact: string;
  ownerBirthDate: string | null;
  createdAt: string;
  updatedAt: string;
  doctorId?: number | null;
  doctor?: Doctor;
  products?: PharmacyProduct[];
  salesRecords?: SalesRecord[];
}

export interface PharmacyProduct {
  id: number;
  pharmacyId: number;
  productId: number;
  createdAt: string;
  pharmacy?: Pharmacy;
  product?: Product;
}

export interface SalesRecord {
  id: number;
  uploadId: number;
  doctorId: number;
  pharmacyId: number;
  productId: number;
  amount: number;
  date: string;
  createdAt: string;
  doctor?: Doctor;
  pharmacy?: Pharmacy;
  product?: Product;
}

export interface Notification {
  id: number;
  entityType: 'DOCTOR' | 'PHARMACY_OWNER';
  entityId: number;
  eventType: 'BIRTHDAY' | 'ANNIVERSARY';
  eventDate: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface DashboardStats {
  doctorCount: number;
  pharmacyCount: number;
  unreadNotifications: number;
}

// Form types
export interface DoctorFormData {
  name: string;
  contact: string;
  address: string;
  birthDate: Date | null;
  isMarried: boolean;
  spouseName: string;
  anniversary: Date | null;
  childrenCount: number;
  childrenNames: string[];
  qualification: string;
  specialization: string;
  registrationNo: string;
  email: string;
  experienceYrs: number;
}

export interface PharmacyFormData {
  name: string;
  ownerName: string;
  licenseId: string;
  gstNumber: string;
  drugLicense: string;
  address: string;
  contact: string;
  ownerBirthDate: Date | null;
}

// API Response types
export interface ApiResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
