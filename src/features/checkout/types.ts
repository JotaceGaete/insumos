import type { UUID } from '@/features/catalog/types';
import type { BillingDocumentType, PreferredCarrier, ShippingPolicy } from './shipping';

export interface CheckoutItemInput {
  variantId: UUID;
  quantity: number;
}

export interface CheckoutShippingAddress {
  region: string;
  comuna: string;
  address: string;
  number: string;
  unit?: string | null;
}

export interface CheckoutBillingData {
  rut: string;
  businessName: string;
  businessActivity: string;
  email: string;
  region: string;
  comuna: string;
  address: string;
  number: string;
  unit?: string | null;
}

export interface CheckoutCustomerInput {
  fullName: string;
  email: string;
  phone: string;
  shippingAddress: CheckoutShippingAddress;
  deliveryNotes?: string | null;
  preferredCarrier: PreferredCarrier;
  billingDocumentType: BillingDocumentType;
  // Required when billingDocumentType === 'factura', absent for 'boleta'.
  billingData?: CheckoutBillingData | null;
}

export interface CheckoutPayload {
  items: CheckoutItemInput[];
  customer: CheckoutCustomerInput;
}

export interface CreatedOrderConfirmation {
  orderId: UUID;
  confirmationToken: string;
  subtotal: number;
  total: number;
  shippingPolicy: ShippingPolicy;
}

export interface OrderConfirmationLine {
  productId: UUID;
  variantId: UUID;
  productName: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderConfirmationDetail {
  id: UUID;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  status: string;
  paymentStatus: string;
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  total: number;
  shippingAddress: CheckoutShippingAddress | null;
  notes: string | null;
  createdAt: string;
  items: OrderConfirmationLine[];
  shippingPolicy: ShippingPolicy;
  preferredCarrier: PreferredCarrier | null;
  billingDocumentType: BillingDocumentType;
  billingData: CheckoutBillingData | null;
}
