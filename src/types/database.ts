/**
 * The Expanse - Domain & Database Types
 *
 * Provides strongly-typed enums and helpers for role-based permissions,
 * Indian GST calculations, audit logging, and financial operations.
 */

export const Role = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  ACCOUNTANT: "ACCOUNTANT",
  VIEWER: "VIEWER",
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

export const AuditAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  EXPORT: "EXPORT",
  STATUS_CHANGE: "STATUS_CHANGE",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditEntity = {
  ORGANIZATION: "ORGANIZATION",
  MEMBERSHIP: "MEMBERSHIP",
  GST_PROFILE: "GST_PROFILE",
  CUSTOMER: "CUSTOMER",
  VENDOR: "VENDOR",
  PRODUCT: "PRODUCT",
  ORDER: "ORDER",
  ORDER_ITEM: "ORDER_ITEM",
  INVOICE: "INVOICE",
  INVOICE_ITEM: "INVOICE_ITEM",
  PAYMENT: "PAYMENT",
  BUSINESS_EXPENSE: "BUSINESS_EXPENSE",
  PERSONAL_ACCOUNT: "PERSONAL_ACCOUNT",
  PERSONAL_TRANSACTION: "PERSONAL_TRANSACTION",
  PERSONAL_BUDGET: "PERSONAL_BUDGET",
  ATTACHMENT: "ATTACHMENT",
} as const;

export type AuditEntityType = (typeof AuditEntity)[keyof typeof AuditEntity];

export const InvoiceStatus = {
  DRAFT: "DRAFT",
  ISSUED: "ISSUED",
  PAID: "PAID",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  OVERDUE: "OVERDUE",
  CANCELLED: "CANCELLED",
} as const;

export type InvoiceStatusType = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const InvoiceType = {
  SALES: "SALES",
  PURCHASE: "PURCHASE",
} as const;

export type InvoiceTypeVal = (typeof InvoiceType)[keyof typeof InvoiceType];

export const OrderStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  PARTIALLY_FULFILLED: "PARTIALLY_FULFILLED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderType = {
  SALES: "SALES",
  PURCHASE: "PURCHASE",
} as const;

export type OrderTypeVal = (typeof OrderType)[keyof typeof OrderType];

export const ProductType = {
  PRODUCT: "PRODUCT",
  SERVICE: "SERVICE",
} as const;

export type ProductTypeVal = (typeof ProductType)[keyof typeof ProductType];

export const PaymentType = {
  INCOMING: "INCOMING",
  OUTGOING: "OUTGOING",
} as const;

export type PaymentTypeVal = (typeof PaymentType)[keyof typeof PaymentType];

export const PaymentMode = {
  BANK_TRANSFER: "BANK_TRANSFER",
  UPI: "UPI",
  CHEQUE: "CHEQUE",
  CASH: "CASH",
  CARD: "CARD",
} as const;

export type PaymentModeVal = (typeof PaymentMode)[keyof typeof PaymentMode];

export const PersonalAccountType = {
  SAVINGS: "SAVINGS",
  CURRENT: "CURRENT",
  CREDIT_CARD: "CREDIT_CARD",
  INVESTMENT: "INVESTMENT",
  WALLET: "WALLET",
  CASH: "CASH",
} as const;

export type PersonalAccountTypeVal = (typeof PersonalAccountType)[keyof typeof PersonalAccountType];

export const TransactionType = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
  TRANSFER: "TRANSFER",
} as const;

export type TransactionTypeVal = (typeof TransactionType)[keyof typeof TransactionType];

// Standard Indian GST Slabs
export const GST_RATES = [0, 5, 12, 18, 28] as const;
export type GstRate = (typeof GST_RATES)[number];

// Standard Indian State Codes for GST
export const INDIAN_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman & Diu",
  "26": "Dadra & Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};
