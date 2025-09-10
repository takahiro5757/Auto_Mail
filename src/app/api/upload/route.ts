import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// Phase 2: 宛先リスト用のインターface
interface ContactData {
  email: string;
  name: string;
  company?: string;
  department?: string;
  position?: string;
}

// Phase 1: メールデータ用（互換性のため残す）
interface EmailData {
  email: string;
  subject: string;
  body: string;
}

/**
 * ファイルの形式を判定（宛先リスト vs メールデータ）
 */
function detectFileType(rawData: Record<string, unknown>[]): boolean {
  if (rawData.length === 0) return false;
  
  const firstRow = rawData[0];
  const keys = Object.keys(firstRow).map(k => k.toLowerCase());
  
  // 宛先リスト形式の判定: email + name があり、subject/body がない
  const hasEmail = keys.some(k => k.includes('email') || k.includes('メール'));
  const hasName = keys.some(k => k.includes('name') || k.includes('氏名') || k.includes('名前'));
  const hasSubject = keys.some(k => k.includes('subject') || k.includes('件名'));
  const hasBody = keys.some(k => k.includes('body') || k.includes('本文') || k.includes('内容'));
  
  return hasEmail && hasName && !hasSubject && !hasBody;
}

/**
 * 宛先リストデータをパース
 */
function parseContactData(rawData: Record<string, unknown>[]): ContactData[] {
  const contacts: ContactData[] = [];

  for (const row of rawData) {
    const normalizedRow: Record<string, string> = {};
    
    // カラム名を正規化
    Object.entries(row).forEach(([key, value]) => {
      const normalizedKey = key.toLowerCase().trim();
      const strValue = String(value || '').trim();
      
      if (normalizedKey.includes('email') || normalizedKey.includes('メール')) {
        normalizedRow.email = strValue;
      } else if (normalizedKey.includes('name') || normalizedKey.includes('氏名') || normalizedKey.includes('名前')) {
        normalizedRow.name = strValue;
      } else if (normalizedKey.includes('company') || normalizedKey.includes('会社') || normalizedKey.includes('企業')) {
        normalizedRow.company = strValue;
      } else if (normalizedKey.includes('department') || normalizedKey.includes('部署') || normalizedKey.includes('部門')) {
        normalizedRow.department = strValue;
      } else if (normalizedKey.includes('position') || normalizedKey.includes('役職') || normalizedKey.includes('職位')) {
        normalizedRow.position = strValue;
      }
    });

    // 必須項目チェック
    if (normalizedRow.email && normalizedRow.name) {
      contacts.push({
        email: normalizedRow.email,
        name: normalizedRow.name,
        company: normalizedRow.company || undefined,
        department: normalizedRow.department || undefined,
        position: normalizedRow.position || undefined,
      });
    }
  }
  
  return contacts;
}

/**
 * Phase 1形式のメールデータをパース（互換性のため）
 */
function parseEmailData(rawData: Record<string, unknown>[]): EmailData[] {
  const emailData: EmailData[] = [];

  for (const row of rawData) {
    const normalizedRow: Record<string, string> = {};
    
    // カラム名を正規化
    Object.entries(row).forEach(([key, value]) => {
      const normalizedKey = key.toLowerCase().trim();
      const strValue = String(value || '').trim();
      
      if (normalizedKey.includes('email') || normalizedKey.includes('メール')) {
        normalizedRow.email = strValue;
      } else if (normalizedKey.includes('subject') || normalizedKey.includes('件名')) {
        normalizedRow.subject = strValue;
      } else if (normalizedKey.includes('body') || normalizedKey.includes('本文') || normalizedKey.includes('内容')) {
        normalizedRow.body = strValue;
      }
    });

    // 必須項目チェック
    if (normalizedRow.email && normalizedRow.subject && normalizedRow.body) {
      emailData.push({
        email: normalizedRow.email,
        subject: normalizedRow.subject,
        body: normalizedRow.body,
      });
    }
  }
  
  return emailData;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const senderEmail = formData.get('senderEmail') as string;

    if (!file) {
      return NextResponse.json({ success: false, error: 'ファイルが選択されていません' }, { status: 400 });
    }

    if (!senderEmail || !senderEmail.includes('@festal-inc.com')) {
      return NextResponse.json({ success: false, error: '有効なFestalのメールアドレスを入力してください' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileName = file.name.toLowerCase();
    let rawData: Record<string, unknown>[] = [];

    try {
      if (fileName.endsWith('.csv')) {
        // CSV処理
        const text = new TextDecoder().decode(arrayBuffer);
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        rawData = parsed.data as Record<string, unknown>[];
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Excel処理
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rawData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
      } else {
        return NextResponse.json({ success: false, error: 'サポートされていないファイル形式です（CSV、Excel のみ対応）' }, { status: 400 });
      }

      if (rawData.length === 0) {
        return NextResponse.json({ success: false, error: 'ファイルにデータが含まれていません' }, { status: 400 });
      }

      // Phase 2: ファイル形式を判定（宛先リスト vs メールデータ）
      const isContactList = detectFileType(rawData);
      
      if (isContactList) {
        // 宛先リスト形式
        const contacts = parseContactData(rawData);
        if (contacts.length === 0) {
          return NextResponse.json({ success: false, error: '有効な宛先データが見つかりませんでした。email と name カラムが必要です。' }, { status: 400 });
        }
        
        return NextResponse.json({ 
          success: true, 
          type: 'contacts',
          data: contacts,
          count: contacts.length 
        });
      } else {
        // Phase 1形式（互換性のため）
        const emailData = parseEmailData(rawData);
        if (emailData.length === 0) {
          return NextResponse.json({ success: false, error: '有効なメールデータが見つかりませんでした。email、subject、body カラムが必要です。' }, { status: 400 });
        }
        
        return NextResponse.json({ 
          success: true, 
          type: 'emails',
          data: emailData,
          count: emailData.length 
        });
      }

    } catch (parseError) {
      console.error('File parsing error:', parseError);
      return NextResponse.json({ success: false, error: 'ファイルの解析に失敗しました' }, { status: 400 });
    }

  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({ success: false, error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}