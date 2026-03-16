import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type Product = { id: string; name: string; current_stock: number; min_stock: number; unit: string };
type Movement = {
  id: string; type: string; quantity: number; reason: string | null; created_at: string;
  products?: { name: string } | null;
  profiles?: { display_name: string } | null;
};

export default function InventoryPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ product_id: '', type: 'entry', quantity: '', reason: '' });

  useEffect(() => { fetchProducts(); fetchMovements(); }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('id, name, current_stock, min_stock, unit').eq('is_active', true).order('name');
    if (data) setProducts(data);
  };

  const fetchMovements = async () => {
    const { data } = await supabase
      .from('inventory_movements')
      .select('*, products(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setMovements(data as any);
  };

  const handleSubmit = async () => {
    if (!user) return;
    const qty = Number(form.quantity);
    if (!form.product_id || !qty) { toast.error('Preencha todos os campos'); return; }

    const { error: moveError } = await supabase.from('inventory_movements').insert({
      product_id: form.product_id, user_id: user.id, type: form.type, quantity: qty, reason: form.reason || null
    });
    if (moveError) { toast.error(moveError.message); return; }

    const product = products.find(p => p.id === form.product_id);
    if (product) {
      let newStock = product.current_stock;
      if (form.type === 'entry') newStock += qty;
      else if (form.type === 'exit') newStock -= qty;
      else newStock = qty;

      await supabase.from('products').update({ current_stock: newStock }).eq('id', form.product_id);
    }

    toast.success('Movimentação registrada!');
    setDialogOpen(false);
    fetchProducts();
    fetchMovements();
  };

  const typeConfig: Record<string, { label: string; color: 'default' | 'secondary' | 'destructive' }> = {
    entry: { label: 'Entrada', color: 'default' },
    exit: { label: 'Saída', color: 'destructive' },
    adjustment: { label: 'Ajuste', color: 'secondary' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display">Controle de Estoque</h1>
        <Button onClick={() => { setForm({ product_id: '', type: 'entry', quantity: '', reason: '' }); setDialogOpen(true); }}>
          <Plus size={16} className="mr-1" /> Nova Movimentação
        </Button>
      </div>

      {/* Low stock alerts */}
      {products.filter(p => p.current_stock <= p.min_stock).length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-warning">⚠️ Produtos com estoque baixo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {products.filter(p => p.current_stock <= p.min_stock).map(p => (
              <Badge key={p.id} variant="secondary">{p.name}: {p.current_stock} {p.unit}</Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-lg">Últimas Movimentações</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map(m => {
                const cfg = typeConfig[m.type] || typeConfig.entry;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">{new Date(m.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="font-medium">{m.products?.name || '—'}</TableCell>
                    <TableCell><Badge variant={cfg.color}>{cfg.label}</Badge></TableCell>
                    <TableCell className="text-right">{m.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{m.reason || '—'}</TableCell>
                  </TableRow>
                );
              })}
              {movements.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma movimentação registrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Produto</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })}>
                <option value="">Selecionar produto</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.current_stock} {p.unit})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <div className="flex gap-2">
                  {(['entry', 'exit', 'adjustment'] as const).map(t => (
                    <Button key={t} variant={form.type === t ? 'default' : 'outline'} size="sm" onClick={() => setForm({ ...form, type: t })}>
                      {t === 'entry' && <ArrowUp size={14} className="mr-1" />}
                      {t === 'exit' && <ArrowDown size={14} className="mr-1" />}
                      {t === 'adjustment' && <RefreshCw size={14} className="mr-1" />}
                      {typeConfig[t].label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
            </div>
            <Button onClick={handleSubmit} className="w-full">Registrar Movimentação</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
