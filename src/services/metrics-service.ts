import { 
  DashboardMetrics, 
  OrderMetrics, 
  Country, 
  PaymentMethod,
  OrderType,
} from '@/types';
import { IOrderRepository, OrderFilters } from '@/repositories/interfaces';
import { startOfDay, subDays, format } from 'date-fns';

// ============================================
// METRICS SERVICE
// Aggregates metrics for admin dashboard
// ============================================

export class MetricsService {
  constructor(private orderRepo: IOrderRepository) {}

  // ==========================================
  // DASHBOARD METRICS
  // ==========================================

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterdayStart = startOfDay(subDays(now, 1));
    const last7DaysStart = startOfDay(subDays(now, 7));

    const [today, yesterday, last7Days, allTime] = await Promise.all([
      this.getMetricsForPeriod(todayStart.toISOString(), now.toISOString()),
      this.getMetricsForPeriod(yesterdayStart.toISOString(), todayStart.toISOString()),
      this.getMetricsForPeriod(last7DaysStart.toISOString(), now.toISOString()),
      this.getMetricsForPeriod(undefined, undefined),
    ]);

    return { today, yesterday, last_7_days: last7Days, all_time: allTime };
  }

  private async getMetricsForPeriod(
    dateFrom?: string, 
    dateTo?: string
  ): Promise<OrderMetrics> {
    const baseFilters: OrderFilters = {
      date_from: dateFrom,
      date_to: dateTo,
    };

    // Get counts in parallel
    const [
      totalOrders,
      normalOrders,
      preorders,
      vorkasseOrders,
      lastschriftOrders,
      paypalOrders,
      klarnaOrders,
      deOrders,
      atOrders,
      withInvoice,
    ] = await Promise.all([
      this.orderRepo.countByFilters(baseFilters),
      this.orderRepo.countByFilters({ ...baseFilters, order_type: 'normal' }),
      this.orderRepo.countByFilters({ ...baseFilters, order_type: 'preorder' }),
      this.orderRepo.countByFilters({ ...baseFilters, payment_method: 'vorkasse' }),
      this.orderRepo.countByFilters({ ...baseFilters, payment_method: 'lastschrift' }),
      this.orderRepo.countByFilters({ ...baseFilters, payment_method: 'paypal' }),
      this.orderRepo.countByFilters({ ...baseFilters, payment_method: 'klarna' }),
      this.orderRepo.countByFilters({ ...baseFilters, country: 'DE' }),
      this.orderRepo.countByFilters({ ...baseFilters, country: 'AT' }),
      this.orderRepo.countByFilters({ ...baseFilters, has_invoice: true }),
    ]);

    // Calculate revenue
    const totalRevenue = await this.calculateRevenue(baseFilters);

    // Count orders pending email (needs weekend hello but not sent)
    const pendingEmail = await this.orderRepo.countByFilters({
      ...baseFilters,
      needs_weekend_hello: true,
    });

    return {
      total_orders: totalOrders,
      total_revenue_gross: totalRevenue,
      by_type: {
        normal: normalOrders,
        preorder: preorders,
      },
      by_payment_method: {
        vorkasse: vorkasseOrders,
        lastschrift: lastschriftOrders,
        paypal: paypalOrders,
        klarna: klarnaOrders,
      },
      by_country: {
        DE: deOrders,
        AT: atOrders,
      },
      orders_with_invoice: withInvoice,
      orders_pending_email: pendingEmail,
    };
  }

  private async calculateRevenue(filters: OrderFilters): Promise<number> {
    // Get all orders matching filters and sum total_gross
    const result = await this.orderRepo.list({
      filters,
      per_page: 10000, // Get all for sum
    });

    return result.items.reduce((sum, order) => sum + order.totals.total_gross, 0);
  }

  // ==========================================
  // DETAILED ANALYTICS
  // ==========================================

  async getOrdersByDate(days: number = 30): Promise<{ date: string; count: number; revenue: number }[]> {
    const results: { date: string; count: number; revenue: number }[] = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const dayStart = startOfDay(subDays(now, i));
      const dayEnd = startOfDay(subDays(now, i - 1));
      
      const count = await this.orderRepo.countByFilters({
        date_from: dayStart.toISOString(),
        date_to: dayEnd.toISOString(),
      });

      const ordersResult = await this.orderRepo.list({
        filters: {
          date_from: dayStart.toISOString(),
          date_to: dayEnd.toISOString(),
        },
        per_page: 1000,
      });

      const revenue = ordersResult.items.reduce((sum, o) => sum + o.totals.total_gross, 0);

      results.push({
        date: format(dayStart, 'yyyy-MM-dd'),
        count,
        revenue,
      });
    }

    return results.reverse();
  }

  async getRevenueByCountry(): Promise<Record<Country, number>> {
    const [deRevenue, atRevenue] = await Promise.all([
      this.calculateRevenue({ country: 'DE' }),
      this.calculateRevenue({ country: 'AT' }),
    ]);

    return { DE: deRevenue, AT: atRevenue };
  }

  async getRevenueByPaymentMethod(): Promise<Record<PaymentMethod, number>> {
    const methods: PaymentMethod[] = ['vorkasse', 'lastschrift', 'paypal', 'klarna'];
    const results: Record<PaymentMethod, number> = {
      vorkasse: 0,
      lastschrift: 0,
      paypal: 0,
      klarna: 0,
    };

    await Promise.all(
      methods.map(async (method) => {
        results[method] = await this.calculateRevenue({ payment_method: method });
      })
    );

    return results;
  }

  async getOrderTypeDistribution(): Promise<{ normal: number; preorder: number }> {
    const [normal, preorder] = await Promise.all([
      this.orderRepo.countByFilters({ order_type: 'normal' }),
      this.orderRepo.countByFilters({ order_type: 'preorder' }),
    ]);

    return { normal, preorder };
  }

  // ==========================================
  // EMAIL STATS
  // ==========================================

  async getEmailStats(): Promise<{
    pending_weekend_hello: number;
    pending_confirmation: number;
    with_invoice: number;
    without_invoice: number;
  }> {
    const [pendingHello, withInvoice, withoutInvoice, total] = await Promise.all([
      this.orderRepo.countByFilters({ needs_weekend_hello: true }),
      this.orderRepo.countByFilters({ has_invoice: true }),
      this.orderRepo.countByFilters({ has_invoice: false }),
      this.orderRepo.countByFilters({}),
    ]);

    return {
      pending_weekend_hello: pendingHello,
      pending_confirmation: 0, // TODO: implement email_flag filter
      with_invoice: withInvoice,
      without_invoice: withoutInvoice,
    };
  }
}

