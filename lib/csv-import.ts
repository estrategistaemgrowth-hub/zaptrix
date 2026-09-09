import Papa from 'papaparse';

export interface ParsedProduct {
  external_id: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  promotional_price: number | null;
  image_url: string | null;
  purchase_url: string | null;
  stock_quantity: number | null;
  variant_size: string | null;
  variant_color: string | null;
  active: boolean;
}

export interface ImportResult {
  products: ParsedProduct[];
  totalRows: number;
  skippedRows: number;
  columnsFound: string[];
}

// Mapeamento de nomes de coluna conhecidos (minúsculo, sem acento) -> campo interno.
// Cobre o export padrão da Tray Commerce e variações genéricas em PT/EN.
const COLUMN_ALIASES: Record<string, keyof ParsedProduct> = {
  'codigo produto': 'external_id',
  'codigo': 'external_id',
  'id': 'external_id',
  'referencia': 'sku',
  'sku': 'sku',
  'nome produto': 'name',
  'nome do produto': 'name',
  'nome': 'name',
  'titulo': 'name',
  'product name': 'name',
  'descricao grande': 'description',
  'descricao': 'description',
  'description': 'description',
  'nome categoria': 'category',
  'categoria': 'category',
  'category': 'category',
  'preco venda': 'price',
  'preco': 'price',
  'price': 'price',
  'preco promocao': 'promotional_price',
  'preco promocional': 'promotional_price',
  'imagem principal': 'image_url',
  'imagem': 'image_url',
  'image': 'image_url',
  'endereco do produto (url tray)': 'purchase_url',
  'url': 'purchase_url',
  'link': 'purchase_url',
  'estoque atual': 'stock_quantity',
  'estoque': 'stock_quantity',
  'stock': 'stock_quantity',
  'disponivel': 'active',
  'disponibilidade': 'active',
  'exibir na loja': 'active',
  'tamanho': 'variant_size',
  'size': 'variant_size',
  'cor': 'variant_color',
  'color': 'variant_color',
};

function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBrazilianPrice(value: string): number | null {
  if (!value || !value.trim()) return null;
  // "9.999,99" -> remove pontos de milhar, troca vírgula por ponto
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

function parseBoolean(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === 'sim' || v === 'yes' || v === 'true' || v === '1';
}

/**
 * Detecta se o texto tem sinais de mojibake (Latin-1 lido como UTF-8) e,
 * se necessário, decodifica o buffer original como ISO-8859-1.
 */
export async function readFileAsText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8Text = new TextDecoder('utf-8').decode(buffer);

  const hasMojibake = /Ã©|Ã§|Ã£|Ã¡|Ã³|Â|Ã/.test(utf8Text) || /�/.test(utf8Text);

  if (hasMojibake) {
    // windows-1252 cobre travessões, aspas curvas etc. que ISO-8859-1 não tem
    // (comum em exports de e-commerce feitos no Windows/Excel no Brasil)
    return new TextDecoder('windows-1252').decode(buffer);
  }

  return utf8Text;
}

export function parseProductsCsv(csvText: string): ImportResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter: '', // auto-detect (;  ou ,)
  });

  const rawColumns = parsed.meta.fields || [];
  const columnMap = new Map<string, keyof ParsedProduct>();

  for (const col of rawColumns) {
    const normalized = normalizeHeader(col);
    const mapped = COLUMN_ALIASES[normalized];
    if (mapped) columnMap.set(col, mapped);
  }

  const products: ParsedProduct[] = [];
  let skippedRows = 0;

  for (const row of parsed.data) {
    const draft: Partial<ParsedProduct> = {};

    for (const [col, field] of columnMap.entries()) {
      const raw = row[col];
      if (raw === undefined) continue;

      switch (field) {
        case 'price':
        case 'promotional_price': {
          const num = parseBrazilianPrice(raw);
          if (num !== null) draft[field] = num;
          break;
        }
        case 'stock_quantity': {
          const num = parseInt(raw, 10);
          draft.stock_quantity = isNaN(num) ? null : num;
          break;
        }
        case 'active':
          draft.active = parseBoolean(raw);
          break;
        case 'description':
          draft.description = raw ? stripHtml(raw) : null;
          break;
        default:
          (draft as any)[field] = raw?.trim() || null;
      }
    }

    if (!draft.name || draft.price === undefined || draft.price === null) {
      skippedRows++;
      continue;
    }

    products.push({
      external_id: draft.external_id ?? null,
      sku: draft.sku ?? null,
      name: draft.name,
      description: draft.description ?? null,
      category: draft.category ?? null,
      price: draft.price,
      promotional_price: draft.promotional_price ?? null,
      image_url: draft.image_url ?? null,
      purchase_url: draft.purchase_url ?? null,
      stock_quantity: draft.stock_quantity ?? null,
      variant_size: draft.variant_size ?? null,
      variant_color: draft.variant_color ?? null,
      active: draft.active ?? true,
    });
  }

  return {
    products,
    totalRows: parsed.data.length,
    skippedRows,
    columnsFound: rawColumns,
  };
}
