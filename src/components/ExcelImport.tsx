import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'number' | 'boolean' | 'date';
};

type ImportTarget = 'products' | 'customers' | 'inventory' | 'finance' | 'sales';

const targetConfig: Record<ImportTarget, { title: string; table: string; fields: FieldDef[] }> = {
  products: {
    title: 'Produtos',
    table: 'products',
    fields: [
      { key: 'name', label: 'Nome', required: true },
      { key: 'sku', label: 'SKU' },
      { key: 'cost_price', label: 'Preço de Custo', type: 'number' },
      { key: 'sell_price', label: 'Preço de Venda', type: 'number' },
      { key: 'current_stock', label: 'Estoque Atual', type: 'number' },
      { key: 'min_stock', label: 'Estoque Mínimo', type: 'number' },
      { key: 'unit', label: 'Unidade' },
      { key: 'description', label: 'Descrição' },
      { key: 'is_active', label: 'Ativo', type: 'boolean' },
    ],
  },
  customers: {
    title: 'Clientes',
    table: 'customers',
    fields: [
      { key: 'name', label: 'Nome', required: true },
      { key: 'email', label: 'E-mail' },
      { key: 'phone', label: 'Telefone' },
      { key: 'address', label: 'Endereço' },
      { key: 'notes', label: 'Observações' },
    ],
  },
  inventory: {
    title: 'Movimentações de Estoque',
    table: 'inventory_movements',
    fields: [
      { key: 'product_name', label: 'Nome do Produto', required: true },
      { key: 'type', label: 'Tipo (entry/exit/adjustment)', required: true },
      { key: 'quantity', label: 'Quantidade', required: true, type: 'number' },
      { key: 'reason', label: 'Motivo' },
    ],
  },
  finance: {
    title: 'Transações Financeiras',
    table: 'financial_transactions',
    fields: [
      { key: 'type', label: 'Tipo (income/expense)', required: true },
      { key: 'category', label: 'Categoria', required: true },
      { key: 'amount', label: 'Valor', required: true, type: 'number' },
      { key: 'description', label: 'Descrição' },
      { key: 'date', label: 'Data', type: 'date' },
      { key: 'is_paid', label: 'Pago', type: 'boolean' },
    ],
  },
  sales: {
    title: 'Vendas',
    table: 'sales',
    fields: [
      { key: 'total', label: 'Total', required: true, type: 'number' },
      { key: 'discount', label: 'Desconto', type: 'number' },
      { key: 'payment_method', label: 'Forma de Pagamento' },
      { key: 'status', label: 'Status' },
      { key: 'notes', label: 'Observações' },
      { key: 'customer_name', label: 'Nome do Cliente' },
    ],
  },
};

interface ExcelImportProps {
  target: ImportTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'done';

export default function ExcelImport({ target, open, onOpenChange, onSuccess }: ExcelImportProps) {
  const { user } = useAuth();
  const config = targetConfig[target];

  const [step, setStep] = useState<Step>('upload');
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [sheetData, setSheetData] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState({ success: 0, errors: 0 });

  const reset = () => {
    setStep('upload');
    setSheetHeaders([]);
    setSheetData([]);
    setMapping({});
    setImporting(false);
    setResult({ success: 0, errors: 0 });
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        if (jsonData.length === 0) {
          toast.error('Planilha vazia ou sem dados válidos');
          return;
        }

        const headers = Object.keys(jsonData[0]);
        setSheetHeaders(headers);
        setSheetData(jsonData);

        // Auto-map by fuzzy matching
        const autoMapping: Record<string, string> = {};
        config.fields.forEach((field) => {
          const match = headers.find((h) => {
            const hLower = h.toLowerCase().trim();
            const fLabel = field.label.toLowerCase();
            const fKey = field.key.toLowerCase();
            return (
              hLower === fLabel ||
              hLower === fKey ||
              hLower.includes(fLabel) ||
              fLabel.includes(hLower) ||
              hLower.includes(fKey) ||
              fKey.includes(hLower) ||
              hLower.replace(/[_\s-]/g, '') === fKey.replace(/[_\s-]/g, '')
            );
          });
          if (match) autoMapping[field.key] = match;
        });
        setMapping(autoMapping);
        setStep('mapping');
      } catch {
        toast.error('Erro ao ler planilha. Verifique o formato do arquivo.');
      }
    };
    reader.readAsBinaryString(file);
  }, [config.fields]);

  const convertValue = (value: any, type?: string): any => {
    if (value === '' || value === null || value === undefined) return null;
    switch (type) {
      case 'number': {
        const s = String(value).replace(/[R$\s]/g, '').replace(',', '.');
        const n = Number(s);
        return isNaN(n) ? 0 : n;
      }
      case 'boolean': {
        const s = String(value).toLowerCase().trim();
        return ['sim', 'yes', 'true', '1', 'ativo', 'pago', 's'].includes(s);
      }
      case 'date': {
        if (typeof value === 'number') {
          // Excel serial date
          const date = XLSX.SSF.parse_date_code(value);
          if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        }
        const d = new Date(value);
        return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
      }
      default:
        return String(value).trim();
    }
  };

  const getMappedRows = () => {
    return sheetData.map((row) => {
      const mapped: Record<string, any> = {};
      config.fields.forEach((field) => {
        const sourceCol = mapping[field.key];
        if (sourceCol && row[sourceCol] !== undefined) {
          mapped[field.key] = convertValue(row[sourceCol], field.type);
        }
      });
      return mapped;
    });
  };

  const handleImport = async () => {
    if (!user) return;
    setImporting(true);
    const rows = getMappedRows();
    let success = 0;
    let errors = 0;

    if (target === 'inventory') {
      // Need to resolve product names to IDs
      const { data: products } = await supabase.from('products').select('id, name').eq('is_active', true);
      const productMap = new Map((products || []).map((p) => [p.name.toLowerCase(), p.id]));

      for (const row of rows) {
        const productId = productMap.get(String(row.product_name || '').toLowerCase());
        if (!productId || !row.quantity) { errors++; continue; }
        const type = ['entry', 'exit', 'adjustment'].includes(row.type) ? row.type : 'entry';
        const { error } = await supabase.from('inventory_movements').insert({
          product_id: productId, user_id: user.id, type, quantity: Number(row.quantity), reason: row.reason || null,
        });
        if (error) errors++; else {
          // Update stock
          if (type === 'entry') {
            await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' as any }); // dummy to keep types
            const { data: prod } = await supabase.from('products').select('current_stock').eq('id', productId).single();
            if (prod) await supabase.from('products').update({ current_stock: prod.current_stock + Number(row.quantity) }).eq('id', productId);
          } else if (type === 'exit') {
            const { data: prod } = await supabase.from('products').select('current_stock').eq('id', productId).single();
            if (prod) await supabase.from('products').update({ current_stock: prod.current_stock - Number(row.quantity) }).eq('id', productId);
          }
          success++;
        }
      }
    } else if (target === 'sales') {
      // Resolve customer names if provided
      const { data: existingCustomers } = await supabase.from('customers').select('id, name');
      const customerMap = new Map((existingCustomers || []).map((c) => [c.name.toLowerCase(), c.id]));

      for (const row of rows) {
        const customerId = row.customer_name ? customerMap.get(String(row.customer_name).toLowerCase()) || null : null;
        const { error } = await supabase.from('sales').insert({
          user_id: user.id,
          total: Number(row.total || 0),
          discount: Number(row.discount || 0),
          payment_method: row.payment_method || 'cash',
          status: row.status || 'completed',
          notes: row.notes || null,
          customer_id: customerId,
        });
        if (error) errors++; else success++;
      }
    } else if (target === 'finance') {
      for (const row of rows) {
        if (!row.type || !row.category || !row.amount) { errors++; continue; }
        const type = ['income', 'expense'].includes(row.type) ? row.type : (
          ['receita', 'entrada'].includes(String(row.type).toLowerCase()) ? 'income' : 'expense'
        );
        const { error } = await supabase.from('financial_transactions').insert({
          user_id: user.id, type, category: row.category, description: row.description || null,
          amount: Number(row.amount), date: row.date || new Date().toISOString().split('T')[0],
          is_paid: row.is_paid ?? false,
        });
        if (error) errors++; else success++;
      }
    } else {
      // products / customers — direct insert
      const BATCH_SIZE = 50;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE).filter((r) => {
          const requiredFields = config.fields.filter((f) => f.required);
          return requiredFields.every((f) => r[f.key]);
        });
        if (batch.length === 0) { errors += BATCH_SIZE; continue; }
        const { error, data } = await supabase.from(config.table as any).insert(batch as any).select();
        if (error) { errors += batch.length; } else { success += (data?.length || batch.length); }
        errors += (rows.slice(i, i + BATCH_SIZE).length - batch.length);
      }
    }

    setResult({ success, errors });
    setStep('done');
    setImporting(false);
    if (success > 0) onSuccess?.();
  };

  const previewRows = getMappedRows().slice(0, 5);
  const mappedFieldKeys = config.fields.filter((f) => mapping[f.key]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <FileSpreadsheet size={20} className="text-primary" />
            Importar {config.title}
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <Upload size={40} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Arraste ou selecione uma planilha Excel (.xlsx, .xls, .csv)
              </p>
              <label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button variant="outline" asChild>
                  <span>Selecionar Arquivo</span>
                </Button>
              </label>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Campos disponíveis para {config.title}:</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {config.fields.map((f) => (
                  <Badge key={f.key} variant={f.required ? 'default' : 'secondary'}>
                    {f.label}{f.required ? ' *' : ''}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 text-xs">* Campos obrigatórios. Sua planilha pode ter qualquer nome de coluna — você fará o mapeamento na próxima etapa.</p>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Encontramos <strong>{sheetData.length}</strong> linhas e <strong>{sheetHeaders.length}</strong> colunas. Mapeie as colunas da sua planilha para os campos do sistema:
            </p>
            <ScrollArea className="h-[40vh]">
              <div className="space-y-3 pr-4">
                {config.fields.map((field) => (
                  <div key={field.key} className="flex items-center gap-3">
                    <div className="w-1/3 text-sm">
                      <span className="font-medium">{field.label}</span>
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </div>
                    <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                    <select
                      className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={mapping[field.key] || ''}
                      onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                    >
                      <option value="">— Não mapear —</option>
                      {sheetHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep('upload')}>Voltar</Button>
              <Button
                onClick={() => setStep('preview')}
                disabled={config.fields.filter((f) => f.required).some((f) => !mapping[f.key])}
              >
                Pré-visualizar
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pré-visualização das primeiras {previewRows.length} de {sheetData.length} linhas:
            </p>
            <ScrollArea className="h-[40vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {mappedFieldKeys.map((f) => (
                      <TableHead key={f.key} className="text-xs">{f.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {mappedFieldKeys.map((f) => (
                        <TableCell key={f.key} className="text-xs">
                          {row[f.key] === null || row[f.key] === undefined ? '—' : String(row[f.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep('mapping')}>Voltar</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? 'Importando...' : `Importar ${sheetData.length} registros`}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-8 space-y-4">
            <CheckCircle2 size={48} className="mx-auto text-primary" />
            <h3 className="text-lg font-semibold">Importação Concluída!</h3>
            <div className="flex justify-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{result.success}</p>
                <p className="text-xs text-muted-foreground">Importados</p>
              </div>
              {result.errors > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-destructive">{result.errors}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              )}
            </div>
            {result.errors > 0 && (
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <AlertCircle size={14} /> Linhas com campos obrigatórios vazios foram ignoradas.
              </p>
            )}
            <Button onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
