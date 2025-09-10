// テンプレートエンジン - 変数置換機能

interface TemplateVariables {
  name: string;
  email: string;
  company?: string;
  department?: string;
  position?: string;
  [key: string]: string | undefined;
}

/**
 * テンプレート文字列内の変数を置換する
 * 例: "{name}様" + {name: "田中太郎"} → "田中太郎様"
 */
export function replaceTemplateVariables(template: string, variables: TemplateVariables): string {
  return template.replace(/\{(\w+)\}/g, (match, variableName) => {
    const value = variables[variableName];
    return value !== undefined ? value : match; // 変数が見つからない場合は元のまま
  });
}

/**
 * テンプレート内で使用されている変数を抽出する
 * 例: "{name}様、{company}の件で" → ["name", "company"]
 */
export function extractTemplateVariables(template: string): string[] {
  const matches = template.match(/\{(\w+)\}/g);
  if (!matches) return [];
  
  return matches
    .map(match => match.replace(/\{|\}/g, ''))
    .filter((variable, index, array) => array.indexOf(variable) === index); // 重複除去
}

/**
 * 宛先データからテンプレート変数を生成する
 */
export function createTemplateVariables(
  contact: { email: string; name: string; company?: string; department?: string; position?: string }
): TemplateVariables {
  return {
    name: contact.name,
    email: contact.email,
    company: contact.company || '',
    department: contact.department || '',
    position: contact.position || '',
  };
}

/**
 * テンプレートをプレビュー用にサンプルデータで置換
 */
export function previewTemplate(template: string): string {
  const sampleVariables: TemplateVariables = {
    name: 'サンプル太郎',
    email: 'sample@example.com',
    company: 'サンプル株式会社',
    department: 'サンプル部',
    position: 'サンプル長'
  };

  return replaceTemplateVariables(template, sampleVariables);
}
