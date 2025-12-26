import {
  User,
  CustomerProfile,
  Address,
  Order,
  OrderItem,
  OrderEvent,
  EmailOutbox,
  OrderStatus,
  PaymentStatus,
  Country,
  OrderType,
  PaymentMethod,
  CreateOrderInput,
  PaginatedResponse,
  DashboardMetrics,
  Product,
} from '@/types';

// ============================================
// REPOSITORY INTERFACES
// These abstract the data layer so we can swap
// storage implementations without refactoring
// ============================================

// ============================================
// USER REPOSITORY
// ============================================

export interface IUserRepository {
  // Find
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  
  // Create
  create(data: {
    email: string;
    password_hash: string;
    role?: 'customer' | 'admin' | 'ops';
  }): Promise<User>;
  
  // Update
  updatePassword(id: string, password_hash: string): Promise<void>;
  updateRole(id: string, role: 'customer' | 'admin' | 'ops'): Promise<void>;
  
  // Admin
  listAdmins(): Promise<User[]>;
  listAll(options?: { role?: string; limit?: number; offset?: number }): Promise<User[]>;
}

// ============================================
// PROFILE REPOSITORY
// ============================================

export interface IProfileRepository {
  findByUserId(userId: string): Promise<CustomerProfile | null>;
  
  create(data: {
    user_id: string;
    first_name: string;
    last_name: string;
    phone?: string;
    company_name?: string;
    vat_id?: string;
    default_country?: Country;
  }): Promise<CustomerProfile>;
  
  update(userId: string, data: Partial<Omit<CustomerProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<CustomerProfile>;
}

// ============================================
// ADDRESS REPOSITORY
// ============================================

export interface IAddressRepository {
  findById(id: string): Promise<Address | null>;
  findByUserId(userId: string): Promise<Address[]>;
  findDefault(userId: string): Promise<Address | null>;
  
  create(data: Omit<Address, 'id' | 'created_at' | 'updated_at'>): Promise<Address>;
  update(id: string, data: Partial<Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<Address>;
  delete(id: string): Promise<void>;
  
  setDefault(userId: string, addressId: string): Promise<void>;
}

// ============================================
// PRODUCT REPOSITORY
// ============================================

export interface IProductRepository {
  findById(id: string): Promise<Product | null>;
  findBySku(sku: string): Promise<Product | null>;
  findAll(options?: { active_only?: boolean }): Promise<Product[]>;
  
  create(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product>;
  update(id: string, data: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>): Promise<Product>;
  
  updatePrices(id: string, prices: { price_net_de?: number; price_net_at?: number }): Promise<void>;
  setActive(id: string, active: boolean): Promise<void>;
}

// ============================================
// ORDER REPOSITORY
// ============================================

export interface OrderFilters {
  status?: OrderStatus;
  order_type?: OrderType;
  country?: Country;
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  user_id?: string;
  email?: string;
  date_from?: string;
  date_to?: string;
  has_invoice?: boolean;
  needs_weekend_hello?: boolean;
  email_flag?: keyof Order['email_flags'];
}

export interface IOrderRepository {
  // Find
  findById(id: string): Promise<Order | null>;
  findByOrderNo(orderNo: string): Promise<Order | null>;
  findBySeq(seq: number): Promise<Order | null>;
  
  // List with filters
  list(options: {
    filters?: OrderFilters;
    page?: number;
    per_page?: number;
    sort_by?: 'created_at' | 'order_seq' | 'total_gross';
    sort_dir?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Order>>;
  
  // List by user
  listByUser(userId: string, options?: { page?: number; per_page?: number }): Promise<PaginatedResponse<Order>>;
  
  // List by email (for guest orders)
  listByEmail(email: string, options?: { page?: number; per_page?: number }): Promise<PaginatedResponse<Order>>;
  
  // Create
  create(data: CreateOrderInput, items: OrderItem[]): Promise<Order>;
  
  // Status updates
  updateStatus(id: string, status: OrderStatus, actorUserId?: string, actorType?: 'admin' | 'ops' | 'system'): Promise<Order>;
  updatePaymentStatus(id: string, status: PaymentStatus, actorUserId?: string): Promise<Order>;
  
  // Delivery
  setDeliveryDate(id: string, date: string, window?: string, actorUserId?: string): Promise<Order>;
  
  // Invoice
  setInvoiceUrl(id: string, url: string): Promise<Order>;
  
  // Email flags
  setEmailFlag(id: string, flag: keyof Order['email_flags'], value: boolean): Promise<Order>;
  
  // Internal notes
  addInternalNote(id: string, note: string, actorUserId: string): Promise<Order>;
  
  // Status automation
  setNextStatusAt(id: string, timestamp: string | null): Promise<void>;
  findPendingStatusTransitions(): Promise<Order[]>;
  
  // Weekend hello
  findNeedingWeekendHello(): Promise<Order[]>;
  
  // Count
  countByFilters(filters: OrderFilters): Promise<number>;
}

// ============================================
// ORDER ITEMS REPOSITORY
// ============================================

export interface IOrderItemRepository {
  findByOrderId(orderId: string): Promise<OrderItem[]>;
  create(item: Omit<OrderItem, 'id' | 'created_at'>): Promise<OrderItem>;
  createMany(items: Omit<OrderItem, 'id' | 'created_at'>[]): Promise<OrderItem[]>;
}

// ============================================
// ORDER EVENTS REPOSITORY
// ============================================

export interface IEventRepository {
  findByOrderId(orderId: string, options?: { limit?: number }): Promise<OrderEvent[]>;
  
  create(event: Omit<OrderEvent, 'id' | 'created_at'>): Promise<OrderEvent>;
  
  // Convenience methods
  logStatusChange(orderId: string, fromStatus: OrderStatus, toStatus: OrderStatus, actorUserId?: string, actorType?: 'admin' | 'ops' | 'system'): Promise<OrderEvent>;
  logPaymentChange(orderId: string, fromStatus: PaymentStatus, toStatus: PaymentStatus, actorUserId?: string): Promise<OrderEvent>;
  logEmailSent(orderId: string, emailType: string): Promise<OrderEvent>;
  logManualOverride(orderId: string, action: string, actorUserId: string, details?: Record<string, unknown>): Promise<OrderEvent>;
}

// ============================================
// EMAIL OUTBOX REPOSITORY
// ============================================

export interface IOutboxRepository {
  findById(id: string): Promise<EmailOutbox | null>;
  findByOrderId(orderId: string): Promise<EmailOutbox[]>;
  
  // Queue management
  findPending(limit?: number): Promise<EmailOutbox[]>;
  findFailed(limit?: number): Promise<EmailOutbox[]>;
  
  // Create
  create(data: Omit<EmailOutbox, 'id' | 'created_at' | 'sent_at' | 'status' | 'attempts'>): Promise<EmailOutbox>;
  
  // Status updates
  markSent(id: string): Promise<void>;
  markFailed(id: string, errorMessage: string): Promise<void>;
  incrementAttempts(id: string): Promise<void>;
  
  // Bulk operations
  createBatch(items: Omit<EmailOutbox, 'id' | 'created_at' | 'sent_at' | 'status' | 'attempts'>[]): Promise<EmailOutbox[]>;
}

// ============================================
// METRICS REPOSITORY
// ============================================

export interface IMetricsRepository {
  getDashboardMetrics(): Promise<DashboardMetrics>;
  
  getOrdersCount(filters: OrderFilters): Promise<number>;
  getRevenueGross(filters: OrderFilters): Promise<number>;
  
  // Time-based
  getOrdersCountByDate(startDate: string, endDate: string): Promise<{ date: string; count: number }[]>;
  getRevenueByDate(startDate: string, endDate: string): Promise<{ date: string; revenue: number }[]>;
  
  // Grouped
  getOrdersByPaymentMethod(filters?: OrderFilters): Promise<Record<PaymentMethod, number>>;
  getOrdersByCountry(filters?: OrderFilters): Promise<Record<Country, number>>;
  getOrdersByStatus(filters?: OrderFilters): Promise<Record<OrderStatus, number>>;
}

// ============================================
// SESSION REPOSITORY (Phase 1 simple auth)
// ============================================

export interface ISessionRepository {
  findByToken(token: string): Promise<{ user_id: string; expires_at: string } | null>;
  create(userId: string, token: string, expiresAt: Date): Promise<void>;
  delete(token: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
  deleteExpired(): Promise<void>;
}

