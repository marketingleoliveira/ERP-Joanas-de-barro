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
import { Plus, Pencil, Search, Upload, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import ExcelImport from '@/components/ExcelImport';

type Product = {
  id: string; name: string; sku: string | null; cost_price: number; sell_price: number;
  current_stock: number; min_stock: number; unit: string; is_active: boolean; category_id: string | null;
  categories?: { name: string } | null;
};

type Category = { id: string; name: string; description: string | null };

export default function ProductsPage() {
  const { userRole } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [catSearch, setCatSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '', sku: '', cost_price: '', sell_price: '', min_stock: '0', unit: 'un', category_id: '', is_active: true
  });

  // Category dialog state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: '', description: '' });

  useEffect(() => { fetchProducts(); fetchCategories(); }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*, categories(name)').order('name');
    if (data) setProducts(data as any);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', sku: '', cost_price: '', sell_price: '', min_stock: '0', unit: 'un', category_id: '', is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku || '', cost_price: String(p.cost_price), sell_price: String(p.sell_price),
      min_stock: String(p.min_stock), unit: p.unit, category_id: p.category_id || '', is_active: p.is_active
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name, sku: form.sku || null, cost_price: Number(form.cost_price), sell_price: Number(form.sell_price),
      min_stock: Number(form.min_stock), unit: form.unit, category_id: form.category_id || null, is_active: form.is_active
    };
    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Produto atualizado!');
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Produto cadastrado!');
    }
    setDialogOpen(false);
    fetchProducts();
  };

  // Category CRUD
  const openNewCat = () => {
    setEditingCat(null);
    setCatForm({ name: '', description: '' });
    setCatDialogOpen(true);
  };

  const openEditCat = (c: Category) => {
    setEditingCat(c);
    setCatForm({ name: c.name, description: c.description || '' });
    setCatDialogOpen(true);
  };

  const handleSaveCat = async () => {
    if (!catForm.name.trim()) { toast.error('Nome da categoria é obrigatório'); return; }
    const payload = { name: catForm.name.trim(), description: catForm.description.trim() || null };
    if (editingCat) {
      const { error } = await supabase.from('categories').update(payload).eq('id', editingCat.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Categoria atualizada!');
    } else {
      const { error } = await supabase.from('categories').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Categoria criada!');
    }
    setCatDialogOpen(false);
    fetchCategories();
    fetchProducts();
  };

  const handleDeleteCat = async (c: Category) => {
    const inUse = products.some(p => p.category_id === c.id);
    if (inUse) { toast.error('Categoria em uso por produtos. Remova a associação primeiro.'); return; }
    const { error } = await supabase.from('categories').delete().eq('id', c.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Categoria excluída!');
    fetchCategories();
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const filteredCats = categories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display">Produtos</h1>
        <div className="flex gap-2">
          {userRole === 'admin' && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload size={16} className="mr-1" /> Importar Excel
            </Button>
          )}
          <Button onClick={openNew}><Plus size={16} className="mr-1" /> Novo Produto</Button>
        </div>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="categories"><Tag size={14} className="mr-1" /> Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>

          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Venda</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.sku || '—'}</TableCell>
                      <TableCell>{p.categories?.name || '—'}</TableCell>
                      <TableCell className="text-right">R$ {Number(p.cost_price).toFixed(2)}</TableCell>
                      <TableCell className="text-right">R$ {Number(p.sell_price).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <span className={p.current_stock <= p.min_stock ? 'text-destructive font-bold' : ''}>
                          {p.current_stock} {p.unit}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? 'default' : 'secondary'}>
                          {p.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                            <Pencil size={14} />
                          </Button>
                          {userRole === 'admin' && (
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={async () => {
                              if (!confirm(`Excluir produto "${p.name}"? Esta ação não pode ser desfeita.`)) return;
                              const { error } = await supabase.from('products').delete().eq('id', p.id);
                              if (error) { toast.error(error.message); return; }
                              toast.success('Produto excluído!');
                              fetchProducts();
                            }}>
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum produto encontrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input placeholder="Buscar categoria..." value={catSearch} onChange={e => setCatSearch(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={openNewCat}><Plus size={16} className="mr-1" /> Nova Categoria</Button>
          </div>

          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Produtos</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCats.map(c => {
                    const count = products.filter(p => p.category_id === c.id).length;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.description || '—'}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{count}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => openEditCat(c)}>
                              <Pencil size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCat(c)} className="text-destructive hover:text-destructive">
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredCats.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma categoria encontrada.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preço de Custo</Label>
                <Input type="number" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Preço de Venda</Label>
                <Input type="number" step="0.01" value={form.sell_price} onChange={e => setForm({ ...form, sell_price: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Estoque Mínimo</Label>
                <Input type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">Sem categoria</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <Button onClick={handleSave} className="w-full">{editing ? 'Salvar Alterações' : 'Cadastrar Produto'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} />
            </div>
            <Button onClick={handleSaveCat} className="w-full">{editingCat ? 'Salvar' : 'Criar Categoria'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ExcelImport target="products" open={importOpen} onOpenChange={setImportOpen} onSuccess={fetchProducts} />
    </div>
  );
}
