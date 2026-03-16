import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import ExcelImport from '@/components/ExcelImport';

type Product = { id: string; name: string; sell_price: number; current_stock: number };
type Customer = { id: string; name: string };
type CartItem = { product: Product; quantity: number };
type Sale = {
  id: string; total: number; discount: number; payment_method: string; status: string;
  created_at: string; customer_id: string | null; customers?: { name: string } | null;
};

export default function SalesPage() {
  const { user, userRole } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [form, setForm] = useState({ customer_id: '', payment_method: 'cash', discount: '0', notes: '' });
  const [search, setSearch] = useState('');

  useEffect(() => { fetchSales(); fetchProducts(); fetchCustomers(); }, []);

  const fetchSales = async () => {
    const { data } = await supabase.from('sales').select('*, customers(name)').order('created_at', { ascending: false }).limit(50);
    if (data) setSales(data as any);
  };
  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('id, name, sell_price, current_stock').eq('is_active', true).order('name');
    if (data) setProducts(data);
  };
  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('id, name').order('name');
    if (data) setCustomers(data);
  };

  const addToCart = (p: Product) => {
    const existing = cart.find(c => c.product.id === p.id);
    if (existing) {
      setCart(cart.map(c => c.product.id === p.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { product: p, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: string) => setCart(cart.filter(c => c.product.id !== productId));
  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { removeFromCart(productId); return; }
    setCart(cart.map(c => c.product.id === productId ? { ...c, quantity: qty } : c));
  };

  const subtotal = cart.reduce((s, c) => s + c.product.sell_price * c.quantity, 0);
  const total = subtotal - Number(form.discount || 0);

  const handleSale = async () => {
    if (!user || cart.length === 0) { toast.error('Adicione itens ao carrinho'); return; }

    const { data: sale, error } = await supabase.from('sales').insert({
      user_id: user.id,
      customer_id: form.customer_id || null,
      total,
      discount: Number(form.discount || 0),
      payment_method: form.payment_method,
      notes: form.notes || null,
      status: 'completed'
    }).select().single();

    if (error || !sale) { toast.error(error?.message || 'Erro ao registrar venda'); return; }

    const items = cart.map(c => ({
      sale_id: sale.id, product_id: c.product.id, quantity: c.quantity,
      unit_price: c.product.sell_price, total: c.product.sell_price * c.quantity
    }));
    await supabase.from('sale_items').insert(items);

    // Update stock
    for (const c of cart) {
      await supabase.from('products').update({ current_stock: c.product.current_stock - c.quantity }).eq('id', c.product.id);
      await supabase.from('inventory_movements').insert({
        product_id: c.product.id, user_id: user.id, type: 'exit', quantity: c.quantity, reason: `Venda #${sale.id.slice(0, 8)}`
      });
    }

    // Register income
    await supabase.from('financial_transactions').insert({
      user_id: user.id, type: 'income', category: 'Vendas', description: `Venda #${sale.id.slice(0, 8)}`,
      amount: total, date: new Date().toISOString().split('T')[0], sale_id: sale.id, is_paid: true
    });

    toast.success('Venda registrada com sucesso!');
    setCart([]);
    setForm({ customer_id: '', payment_method: 'cash', discount: '0', notes: '' });
    setDialogOpen(false);
    fetchSales();
    fetchProducts();
  };

  const paymentLabels: Record<string, string> = { cash: 'Dinheiro', credit: 'Crédito', debit: 'Débito', pix: 'PIX', transfer: 'Transferência' };
  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    completed: { label: 'Concluída', variant: 'default' },
    pending: { label: 'Pendente', variant: 'secondary' },
    cancelled: { label: 'Cancelada', variant: 'destructive' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display">Vendas</h1>
        <Button onClick={() => setDialogOpen(true)}><Plus size={16} className="mr-1" /> Nova Venda</Button>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map(s => {
                const st = statusLabels[s.status] || statusLabels.completed;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{s.customers?.name || 'Não informado'}</TableCell>
                    <TableCell>{paymentLabels[s.payment_method] || s.payment_method}</TableCell>
                    <TableCell className="text-right font-medium">R$ {Number(s.total).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
              {sales.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma venda registrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Venda</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            {/* Product search */}
            <div className="space-y-2">
              <Label>Adicionar Produto</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              {search && (
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => (
                    <button key={p.id} onClick={() => { addToCart(p); setSearch(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between">
                      <span>{p.name}</span>
                      <span className="text-muted-foreground">R$ {p.sell_price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cart */}
            {cart.length > 0 && (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center w-24">Qtd</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map(c => (
                      <TableRow key={c.product.id}>
                        <TableCell className="text-sm">{c.product.name}</TableCell>
                        <TableCell>
                          <Input type="number" min={1} value={c.quantity} onChange={e => updateQty(c.product.id, Number(e.target.value))} className="w-20 text-center mx-auto" />
                        </TableCell>
                        <TableCell className="text-right">R$ {(c.product.sell_price * c.quantity).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeFromCart(c.product.id)}><Trash2 size={14} /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente (opcional)</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                  <option value="">Não informado</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Pagamento</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
                  {Object.entries(paymentLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Desconto (R$)</Label>
              <Input type="number" step="0.01" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} />
            </div>

            <div className="flex justify-between items-center text-lg font-bold border-t pt-4">
              <span>Total</span>
              <span className="text-primary">R$ {total.toFixed(2)}</span>
            </div>

            <Button onClick={handleSale} className="w-full" disabled={cart.length === 0}>Finalizar Venda</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
