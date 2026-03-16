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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, TrendingUp, TrendingDown, Check, X, Upload } from 'lucide-react';
import { toast } from 'sonner';
import ExcelImport from '@/components/ExcelImport';

type Transaction = {
  id: string; type: string; category: string; description: string | null;
  amount: number; date: string; is_paid: boolean; created_at: string;
};

export default function FinancePage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ type: 'income', category: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], is_paid: false });
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  useEffect(() => { fetchTransactions(); }, []);

  const fetchTransactions = async () => {
    const { data } = await supabase.from('financial_transactions').select('*').order('date', { ascending: false }).limit(100);
    if (data) setTransactions(data);
  };

  const handleSave = async () => {
    if (!user) return;
    const { error } = await supabase.from('financial_transactions').insert({
      user_id: user.id, type: form.type, category: form.category, description: form.description || null,
      amount: Number(form.amount), date: form.date, is_paid: form.is_paid
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Transação registrada!');
    setDialogOpen(false);
    fetchTransactions();
  };

  const togglePaid = async (t: Transaction) => {
    await supabase.from('financial_transactions').update({ is_paid: !t.is_paid }).eq('id', t.id);
    fetchTransactions();
  };

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.type === filter);
  const totalIncome = transactions.filter(t => t.type === 'income' && t.is_paid).reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense' && t.is_paid).reduce((s, t) => s + Number(t.amount), 0);

  const expenseCategories = ['Fornecedores', 'Aluguel', 'Salários', 'Marketing', 'Frete', 'Embalagens', 'Impostos', 'Outros'];
  const incomeCategories = ['Vendas', 'Serviços', 'Outros'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display">Financeiro</h1>
        <Button onClick={() => { setForm({ type: 'income', category: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], is_paid: false }); setDialogOpen(true); }}>
          <Plus size={16} className="mr-1" /> Nova Transação
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Receitas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-success">R$ {totalIncome.toFixed(2)}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Despesas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">R$ {totalExpense.toFixed(2)}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-success' : 'text-destructive'}`}>R$ {(totalIncome - totalExpense).toFixed(2)}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" onValueChange={v => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="income">Receitas</TabsTrigger>
          <TabsTrigger value="expense">Despesas</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground">{new Date(t.date).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>
                    {t.type === 'income' ? <TrendingUp size={16} className="text-success" /> : <TrendingDown size={16} className="text-destructive" />}
                  </TableCell>
                  <TableCell>{t.category}</TableCell>
                  <TableCell className="text-muted-foreground">{t.description || '—'}</TableCell>
                  <TableCell className={`text-right font-medium ${t.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                    R$ {Number(t.amount).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.is_paid ? 'default' : 'secondary'}>{t.is_paid ? 'Pago' : 'Pendente'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => togglePaid(t)} title={t.is_paid ? 'Marcar pendente' : 'Marcar pago'}>
                      {t.is_paid ? <X size={14} /> : <Check size={14} />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma transação encontrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Transação</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="flex gap-2">
              <Button variant={form.type === 'income' ? 'default' : 'outline'} className="flex-1" onClick={() => setForm({ ...form, type: 'income', category: '' })}>
                <TrendingUp size={14} className="mr-1" /> Receita
              </Button>
              <Button variant={form.type === 'expense' ? 'default' : 'outline'} className="flex-1" onClick={() => setForm({ ...form, type: 'expense', category: '' })}>
                <TrendingDown size={14} className="mr-1" /> Despesa
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">Selecionar</option>
                {(form.type === 'income' ? incomeCategories : expenseCategories).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_paid} onChange={e => setForm({ ...form, is_paid: e.target.checked })} className="rounded border-input" />
              Já foi pago/recebido
            </label>
            <Button onClick={handleSave} className="w-full">Registrar Transação</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
