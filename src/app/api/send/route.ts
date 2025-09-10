import { NextRequest, NextResponse } from 'next/server';
import { ConfidentialClientApplication } from '@azure/msal-node';

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`
  }
};

async function getAccessToken(): Promise<string> {
  try {
    const cca = new ConfidentialClientApplication(msalConfig);
    const scopes = ['https://graph.microsoft.com/.default'];
    
    const result = await cca.acquireTokenByClientCredential({
      scopes: scopes,
    });

    if (result?.accessToken) {
      return result.accessToken;
    } else {
      throw new Error('アクセストークンの取得に失敗しました');
    }
  } catch (error) {
    console.error('認証エラー:', error);
    throw new Error('Microsoft Graph API認証に失敗しました');
  }
}

async function sendEmailViaGraph(
  senderEmail: string,
  recipientEmail: string,
  subject: string,
  body: string,
  accessToken: string
): Promise<{ success: boolean; message: string }> {
  try {
    const emailData = {
      message: {
        subject: subject,
        body: {
          contentType: 'Text',
          content: body
        },
        toRecipients: [
          {
            emailAddress: {
              address: recipientEmail
            }
          }
        ]
      }
    };

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (response.status === 202) {
      return { success: true, message: '送信成功' };
    } else {
      const errorText = await response.text();
      console.error('Graph API エラー:', response.status, errorText);
      return { success: false, message: `送信失敗: ${response.status}` };
    }
  } catch (error) {
    console.error('メール送信エラー:', error);
    return { success: false, message: 'ネットワークエラー' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { senderEmail, recipientEmail, subject, body: emailBody, authenticatedUserEmail } = body;

    // 入力検証
    if (!senderEmail || !recipientEmail || !subject || !emailBody || !authenticatedUserEmail) {
      return NextResponse.json({ 
        success: false, 
        message: '必須項目が不足しています' 
      }, { status: 400 });
    }

    // セキュリティ検証: 送信者は認証済みユーザーと同一である必要がある
    if (senderEmail !== authenticatedUserEmail) {
      return NextResponse.json({ 
        success: false, 
        message: '認証済みアカウント以外からの送信は許可されていません' 
      }, { status: 403 });
    }

    if (!senderEmail.includes('@festal-inc.com')) {
      return NextResponse.json({ 
        success: false, 
        message: '有効なFestalのメールアドレスを指定してください' 
      }, { status: 400 });
    }

    // アクセストークン取得
    const accessToken = await getAccessToken();

    // メール送信
    const result = await sendEmailViaGraph(
      senderEmail,
      recipientEmail,
      subject,
      emailBody,
      accessToken
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error('API エラー:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'サーバーエラーが発生しました' 
    }, { status: 500 });
  }
}