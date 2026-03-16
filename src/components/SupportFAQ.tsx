import { HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

const faqItems = [
  {
    category: 'Primeiros Passos',
    questions: [
      {
        q: 'Como faço login no sistema?',
        a: 'Acesse a página de login com seu e-mail e senha cadastrados. Caso não tenha uma conta, clique em "Criar conta" e preencha os dados solicitados.',
      },
      {
        q: 'Quais são os tipos de usuário?',
        a: 'O sistema possui três perfis: Administrador (acesso total), Gerente (gerencia produtos, estoque e vendas) e Vendedor (registra vendas e consulta produtos).',
      },
    ],
  },
  {
    category: 'Produtos',
    questions: [
      {
        q: 'Como cadastrar um novo produto?',
        a: 'Acesse o menu "Produtos", clique em "Novo Produto", preencha nome, preço de custo, preço de venda, unidade e categoria, depois salve.',
      },
      {
        q: 'Como editar ou desativar um produto?',
        a: 'Na lista de produtos, clique no produto desejado para editar suas informações. Para desativar, altere o status para inativo.',
      },
      {
        q: 'O que é o SKU?',
        a: 'SKU é um código único de identificação do produto. Ele é opcional, mas facilita buscas e controle interno.',
      },
    ],
  },
  {
    category: 'Estoque',
    questions: [
      {
        q: 'Como dar entrada no estoque?',
        a: 'Acesse "Estoque", clique em "Nova Movimentação", selecione o tipo "Entrada", escolha o produto, informe a quantidade e o motivo.',
      },
      {
        q: 'Como registrar saída de estoque?',
        a: 'No mesmo formulário de movimentação, selecione o tipo "Saída". As vendas também reduzem o estoque automaticamente.',
      },
      {
        q: 'O que significa estoque mínimo?',
        a: 'É a quantidade mínima que você deseja manter. Quando o estoque atual ficar abaixo desse valor, o sistema exibirá um alerta no Dashboard.',
      },
    ],
  },
  {
    category: 'Vendas',
    questions: [
      {
        q: 'Como registrar uma venda?',
        a: 'Acesse "Vendas", busque os produtos desejados, adicione ao carrinho com a quantidade, aplique desconto se necessário, selecione o cliente e a forma de pagamento, e finalize.',
      },
      {
        q: 'Posso aplicar desconto na venda?',
        a: 'Sim! No momento da venda, há um campo para informar o valor do desconto em reais que será subtraído do total.',
      },
      {
        q: 'A venda atualiza o estoque automaticamente?',
        a: 'Sim. Ao finalizar uma venda, o estoque dos produtos vendidos é reduzido automaticamente e uma movimentação de saída é registrada.',
      },
    ],
  },
  {
    category: 'Financeiro',
    questions: [
      {
        q: 'Como registrar uma receita ou despesa?',
        a: 'Acesse "Financeiro", clique em "Nova Transação", selecione o tipo (Receita ou Despesa), informe valor, categoria, descrição e data.',
      },
      {
        q: 'O que é o status "Pago"?',
        a: 'Indica se a transação já foi efetivamente paga/recebida. Você pode alternar esse status clicando no botão correspondente.',
      },
      {
        q: 'As vendas geram registros financeiros?',
        a: 'Sim. Toda venda finalizada gera automaticamente uma receita no módulo financeiro com a categoria "Vendas".',
      },
    ],
  },
  {
    category: 'Clientes',
    questions: [
      {
        q: 'Como cadastrar um cliente?',
        a: 'Acesse "Clientes", clique em "Novo Cliente", preencha nome, telefone, e-mail, endereço e observações, depois salve.',
      },
      {
        q: 'Posso vincular um cliente a uma venda?',
        a: 'Sim. No momento da venda, há um campo para selecionar o cliente. Isso ajuda no histórico de compras.',
      },
    ],
  },
  {
    category: 'Dashboard',
    questions: [
      {
        q: 'O que é exibido no Dashboard?',
        a: 'O Dashboard mostra um resumo com total de vendas do mês, receita, quantidade de produtos e alertas de estoque baixo, além de um gráfico de vendas dos últimos 30 dias.',
      },
      {
        q: 'Os dados do Dashboard são em tempo real?',
        a: 'Os dados são carregados ao acessar a página. Para atualizar, basta recarregar o Dashboard.',
      },
    ],
  },
];

export default function SupportFAQ() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground hover:text-sidebar-accent-foreground"
        >
          <HelpCircle size={16} className="mr-2" />
          Suporte / Ajuda
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Central de Ajuda — Joanas de Barro
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[65vh] pr-4">
          <Accordion type="multiple" className="w-full">
            {faqItems.map((section, si) => (
              <div key={si} className="mb-4">
                <h3 className="text-sm font-semibold text-primary mb-2 uppercase tracking-wide">
                  {section.category}
                </h3>
                {section.questions.map((item, qi) => (
                  <AccordionItem key={`${si}-${qi}`} value={`${si}-${qi}`}>
                    <AccordionTrigger className="text-sm text-left hover:no-underline">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </div>
            ))}
          </Accordion>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
