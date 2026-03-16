import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';
import ExcelImport from '@/components/ExcelImport';

type Customer = { id: string; name: string; email: string | null; phone: string | null; address: string | null; notes: string | null };

export default function CustomersPage() {
  const { userRole } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', notes: '' });

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('name');
    if (data) setCustomers(data);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', email: '', phone: '', address: '', notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '', notes: c.notes || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = { name: form.name, email: form.email || null, phone: form.phone || null, address: form.address || null, notes: form.notes || null };
    if (editing) {
      const { error } = await supabase.from('customers').update(payload).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Cliente atualizado!');
    } else {
      const { error } = await supabase.from('customers').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Cliente cadastrado!');
    }
    setDialogOpen(false);
    fetchCustomers();
  };

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display">Clientes</h1>
        <Button onClick={openNew}><Plus size={16} className="mr-1" /> Novo Cliente</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.address || '—'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil size={14} /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum cliente encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Endereço</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="space-y-2"><Label>Observações</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={handleSave} className="w-full">{editing ? 'Salvar Alterações' : 'Cadastrar Cliente'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
