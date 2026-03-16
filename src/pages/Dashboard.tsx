import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, DollarSign, ShoppingCart, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Stats {
  totalProducts: number;
  lowStockCount: number;
  totalSales: number;
  revenue: number;
  expenses: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ totalProducts: 0, lowStockCount: 0, totalSales: 0, revenue: 0, expenses: 0 });
  const [salesChart, setSalesChart] = useState<{ date: string; total: number }[]>([]);

  useEffect(() => {
    fetchStats();
    fetchSalesChart();
  }, []);

  const fetchStats = async () => {
    const [productsRes, lowStockRes, salesRes, incomeRes, expenseRes] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }).filter('current_stock', 'lte', 'min_stock' as any),
      supabase.from('sales').select('total').eq('status', 'completed'),
      supabase.from('financial_transactions').select('amount').eq('type', 'income').eq('is_paid', true),
      supabase.from('financial_transactions').select('amount').eq('type', 'expense').eq('is_paid', true),
    ]);

    setStats({
      totalProducts: productsRes.count || 0,
      lowStockCount: lowStockRes.count || 0,
      totalSales: salesRes.data?.length || 0,
      revenue: salesRes.data?.reduce((sum, s) => sum + Number(s.total), 0) || 0,
      expenses: expenseRes.data?.reduce((sum, s) => sum + Number(s.amount), 0) || 0,
    });
  };

  const fetchSalesChart = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data } = await supabase
      .from('sales')
      .select('total, created_at')
      .eq('status', 'completed')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at');

    if (data) {
      const grouped: Record<string, number> = {};
      data.forEach(s => {
        const date = new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        grouped[date] = (grouped[date] || 0) + Number(s.total);
      });
      setSalesChart(Object.entries(grouped).map(([date, total]) => ({ date, total })));
    }
  };

  const cards = [
    { title: 'Produtos', value: stats.totalProducts, icon: Package, color: 'text-primary' },
    { title: 'Estoque Baixo', value: stats.lowStockCount, icon: AlertTriangle, color: 'text-warning' },
    { title: 'Vendas', value: stats.totalSales, icon: ShoppingCart, color: 'text-success' },
    { title: 'Receita', value: `R$ ${stats.revenue.toFixed(2)}`, icon: DollarSign, color: 'text-success' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-display">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <Card key={card.title} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-display">Vendas — Últimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent>
          {salesChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-12">Nenhuma venda registrada nos últimos 30 dias.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
