import { NextRequest, NextResponse } from 'next/server';
import { ConfidentialClientApplication } from '@azure/msal-node';

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`
  }
};

export async function POST(request: NextRequest) {
  try {
    const { userEmail } = await request.json();

    if (!userEmail || !userEmail.includes('@festal-inc.com')) {
      return NextResponse.json({ 
        success: false, 
        error: '有効なFestalのメールアドレスを指定してください' 
      }, { status: 400 });
    }

    // アクセストークン取得
    const cca = new ConfidentialClientApplication(msalConfig);
    const scopes = ['https://graph.microsoft.com/.default'];
    
    const result = await cca.acquireTokenByClientCredential({
      scopes: scopes,
    });

    if (!result?.accessToken) {
      throw new Error('アクセストークンの取得に失敗しました');
    }

    // ユーザー情報取得・存在確認
    const userResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${userEmail}`, {
      headers: {
        'Authorization': `Bearer ${result.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      return NextResponse.json({ 
        success: false, 
        error: 'ユーザーが見つかりません。正しいメールアドレスを入力してください。' 
      }, { status: 404 });
    }

    const user = await userResponse.json();

    return NextResponse.json({
      success: true,
      user: {
        displayName: user.displayName,
        email: user.mail || user.userPrincipalName,
        department: user.department || '不明'
      }
    });

  } catch (error) {
    console.error('認証エラー:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'サーバーエラーが発生しました' 
    }, { status: 500 });
  }
}