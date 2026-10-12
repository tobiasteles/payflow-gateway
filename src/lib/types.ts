export type Brand = 'visa' | 'mastercard' | 'elo';
export type PaymentMode = 'debit' | 'credit' | 'credit_installments';
export type TxStatus = 'approved' | 'processing' | 'retrying' | 'failed' | 'refunded';

export interface ChargeRequest {
  amountCents: number;
  brand: Brand;
  mode: PaymentMode;
  installments: number;
}

export interface Charge extends ChargeRequest {
  id: string;
  status: TxStatus;
  mdrCents: number;
  netCents: number;
  payoutDate: string; // YYYY-MM-DD
  createdAt: string; // ISO
}
