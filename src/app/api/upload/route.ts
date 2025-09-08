import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface EmailData {
  email: string;
  subject: string;
  body: string;
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
    let data: EmailData[] = [];

    try {
      if (fileName.endsWith('.csv')) {
        // CSV処理
        const text = new TextDecoder().decode(arrayBuffer);
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        data = parseEmailData(parsed.data as Record<string, unknown>[]);
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Excel処理
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        data = parseEmailData(jsonData as Record<string, unknown>[]);
      } else {
        return NextResponse.json({ success: false, error: 'サポートされていないファイル形式です' }, { status: 400 });
      }

      if (data.length === 0) {
        return NextResponse.json({ success: false, error: '有効なデータが見つかりませんでした' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        data: data,
        count: data.length
      });

    } catch (parseError) {
      console.error('ファイル解析エラー:', parseError);
      return NextResponse.json({ success: false, error: 'ファイルの解析に失敗しました' }, { status: 400 });
    }

  } catch (error) {
    console.error('アップロードエラー:', error);
    return NextResponse.json({ success: false, error: 'ファイルのアップロードに失敗しました' }, { status: 500 });
  }
}

function parseEmailData(rawData: Record<string, unknown>[]): EmailData[] {
  const emailData: EmailData[] = [];

  for (const row of rawData) {
    // カラム名の正規化
    let email = '';
    let subject = '';
    let body = '';

    // メールアドレスの検索
    const emailKeys = Object.keys(row).filter(key => {
      const lowerKey = key.toLowerCase().trim();
      return lowerKey.includes('宛先') || 
             lowerKey.includes('email') || 
             lowerKey.includes('メール') || 
             lowerKey.includes('mail') ||
             lowerKey === 'to';
    });
    if (emailKeys.length > 0) {
      email = String(row[emailKeys[0]] || '').trim();
    }

    // 件名の検索
    const subjectKeys = Object.keys(row).filter(key => {
      const lowerKey = key.toLowerCase().trim();
      return lowerKey.includes('件名') || 
             lowerKey.includes('subject') || 
             lowerKey.includes('タイトル') ||
             lowerKey.includes('title');
    });
    if (subjectKeys.length > 0) {
      subject = String(row[subjectKeys[0]] || '').trim();
    }

    // 本文の検索
    const bodyKeys = Object.keys(row).filter(key => {
      const lowerKey = key.toLowerCase().trim();
      return lowerKey.includes('本文') || 
             lowerKey.includes('body') || 
             lowerKey.includes('content') ||
             lowerKey.includes('内容') ||
             lowerKey.includes('message');
    });
    if (bodyKeys.length > 0) {
      body = String(row[bodyKeys[0]] || '').trim();
    }

    // 有効なデータのみ追加
    if (email && email.includes('@') && subject && body) {
      emailData.push({ email, subject, body });
    }
  }

  return emailData;
}